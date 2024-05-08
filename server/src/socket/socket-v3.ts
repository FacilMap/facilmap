import { promiseProps, type PromiseMap } from "../utils/utils.js";
import { iterableToArray, mapAsyncIterable, streamToString } from "../utils/streams.js";
import { isInBbox } from "../utils/geo.js";
import { exportLineToRouteGpx, exportLineToTrackGpx } from "../export/gpx.js";
import { find } from "../search.js";
import { cloneDeep, isEqual, omit } from "lodash-es";
import Database, { type DatabaseEvents } from "../database/database.js";
import { type Bbox, type BboxWithZoom, type SocketEvents, type MultipleEvents, type MapData, type MapId, SocketVersion, Writable, MapNotFoundError, type SocketServerToClientEmitArgs, type EventName, type MapSlug } from "facilmap-types";
import { prepareForBoundingBox } from "../routing/routing.js";
import type { RouteWithId } from "../database/route.js";
import { type SocketConnection, type DatabaseHandlers, type SocketHandlers } from "./socket-common.js";
import { getI18n, setDomainUnits } from "../i18n.js";
import { ApiV3Backend } from "../api/api-v3.js";

export type MultipleEventPromises = {
	[eventName in keyof MultipleEvents<SocketEvents<SocketVersion.V3>>]: PromiseLike<MultipleEvents<SocketEvents<SocketVersion.V3>>[eventName]> | MultipleEvents<SocketEvents<SocketVersion.V3>>[eventName];
}

export async function objectStreamToMultipleEvents<T extends [string, any]>(stream: AsyncIterable<T>): Promise<{
	[Key in T[0]]: Array<Extract<T, [Key, any]>[1]>;
}> {
	const result: any = {};
	for await (const [key, object] of stream) {
		if (!result[key]) {
			result[key] = [];
		}
		result[key].push(object);
	}
	return result;
}

export class SocketConnectionV3 implements SocketConnection<SocketVersion.V3> {

	emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V3>) => void;
	database: Database;
	remoteAddr: string;
	api: ApiV3Backend;

	mapSlug: MapSlug | undefined = undefined;
	mapId: MapId | undefined = undefined;
	bbox: BboxWithZoom | undefined = undefined;
	writable: Writable | undefined = undefined;
	route: Omit<RouteWithId, "trackPoints"> | undefined = undefined;
	routes: Record<string, Omit<RouteWithId, "trackPoints">> = { };
	listeningToHistory = false;
	pauseHistoryListener = 0;

	unregisterDatabaseHandlers = (): void => undefined;

	constructor(emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V3>) => void, database: Database, remoteAddr: string) {
		this.emit = emit;
		this.database = database;
		this.remoteAddr = remoteAddr;
		this.api = new ApiV3Backend(database, remoteAddr);

		this.registerDatabaseHandlers();
	}

	getMapObjects(mapData: MapData & { writable: Writable }): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		const promises: PromiseMap<MultipleEvents<SocketEvents<SocketVersion.V3>>> = {
			mapData: [ mapData ],
			view: iterableToArray(this.database.views.getViews(mapData.id)),
			type: iterableToArray(this.database.types.getTypes(mapData.id)),
			line: iterableToArray(this.database.lines.getMapLines(mapData.id))
		};

		if(this.bbox) { // In case bbox is set while fetching map data
			Object.assign(promises, {
				marker: iterableToArray(this.database.markers.getMapMarkers(mapData.id, this.bbox)),
				linePoints: iterableToArray(this.database.lines.getLinePointsForMap(mapData.id, this.bbox))
			});
		}

		return promiseProps(promises);
	}

	validatePermissions(minimumPermissions: Writable): void {
		if (minimumPermissions == Writable.ADMIN && ![Writable.ADMIN].includes(this.writable!))
			throw new Error(getI18n().t("socket.only-in-admin-error"));
		else if (minimumPermissions === Writable.WRITE && ![Writable.ADMIN, Writable.WRITE].includes(this.writable!))
			throw new Error(getI18n().t("socket.only-in-write-error"));
	}

	handleDisconnect(): void {
		if(this.route) {
			this.database.routes.deleteRoute(this.route.id).catch((err) => {
				console.error("Error clearing route", err);
			});
		}

		for (const routeId of Object.keys(this.routes)) {
			this.database.routes.deleteRoute(this.routes[routeId].id).catch((err) => {
				console.error("Error clearing route", err);
			});
		}

		this.unregisterDatabaseHandlers();
	};

	getSocketHandlers(): SocketHandlers<SocketVersion.V3> {
		return {
			setMapId: async (mapSlug) => {
				if(this.mapSlug != null)
					throw new Error(getI18n().t("socket.map-id-set-error"));

				this.mapSlug = mapSlug;

				const [admin, write, read] = await Promise.all([
					this.database.maps.getMapDataByAdminId(mapSlug),
					this.database.maps.getMapDataByWriteId(mapSlug),
					this.database.maps.getMapData(mapSlug)
				]);

				let map;
				if(admin)
					map = { ...admin, writable: Writable.ADMIN };
				else if(write)
					map = omit({ ...write, writable: Writable.WRITE }, ["adminId"]);
				else if(read)
					map = omit({ ...read, writable: Writable.READ }, ["writeId", "adminId"]);
				else {
					this.mapSlug = undefined;
					throw new MapNotFoundError(getI18n().t("socket.map-not-exist-error"));
				}

				this.mapId = map.id;
				this.writable = map.writable;

				this.registerDatabaseHandlers();

				return await this.getMapObjects(map);
			},

			setLanguage: async (settings) => {
				if (settings.lang) {
					await getI18n().changeLanguage(settings.lang);
				}
				if (settings.units) {
					setDomainUnits(settings.units);
				}
			},

			updateBbox: async (bbox) => {
				this.validatePermissions(Writable.READ);

				const markerBboxWithExcept: BboxWithZoom & { except?: Bbox } = { ...bbox };
				const lineBboxWithExcept: BboxWithZoom & { except?: Bbox } = { ...bbox };
				if(this.bbox) {
					markerBboxWithExcept.except = this.bbox;
					if (bbox.zoom == this.bbox.zoom) {
						lineBboxWithExcept.except = this.bbox;
					}
				}

				this.bbox = bbox;

				const ret: MultipleEventPromises = {};

				if(this.mapId) {
					ret.marker = iterableToArray(this.database.markers.getMapMarkers(this.mapId, markerBboxWithExcept));
					ret.linePoints = iterableToArray(mapAsyncIterable(this.database.lines.getLinePointsForMap(this.mapId, lineBboxWithExcept), ({ lineId, ...rest }) => ({ id: lineId, ...rest })));
				}
				if(this.route)
					ret.routePoints = this.database.routes.getRoutePoints(this.route.id, lineBboxWithExcept, !lineBboxWithExcept.except).then((points) => ([points]));
				if(Object.keys(this.routes).length > 0) {
					ret.routePointsWithId = Promise.all(Object.keys(this.routes).map(
						(routeId) => this.database.routes.getRoutePoints(this.routes[routeId].id, lineBboxWithExcept, !lineBboxWithExcept.except).then((trackPoints) => ({ routeId, trackPoints }))
					));
				}

				return await promiseProps(ret);
			},

			getMap: async (data) => {
				const mapData = await this.database.maps.getMapDataByAnyId(data.mapId);
				return mapData && {
					id: mapData.id,
					name: mapData.name,
					description: mapData.description
				};
			},

			findMaps: async (data) => {
				const { query, ...other } = data;
				return await this.api.findMaps(query, other);
			},

			createMap: async (data) => {
				if(this.mapSlug)
					throw new Error(getI18n().t("socket.map-already-loaded-error"));

				const result = await this.api.createMap(data);
				const events = await objectStreamToMultipleEvents(result.results);
				const mapData = events.mapData[0];

				this.mapSlug = mapData.adminId;
				this.mapId = mapData.id;
				this.writable = Writable.ADMIN;

				this.registerDatabaseHandlers();

				return events;
			},

			editMap: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.api.updateMap(this.mapSlug, data);
			},

			deleteMap: async () => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				await this.api.deleteMap(this.mapSlug);
			},

			getMarker: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.api.getMarker(this.mapSlug, data.id);
			},

			addMarker: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.api.createMarker(this.mapSlug, data);
			},

			editMarker: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.api.updateMarker(this.mapSlug, data.id, data);
			},

			deleteMarker: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const marker = await this.api.getMarker(this.mapSlug, data.id);
				await this.api.deleteMarker(this.mapSlug, data.id);
				return marker;
			},

			getLineTemplate: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!this.mapId)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.lines.getLineTemplate(this.mapId, data);
			},

			addLine: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				let fromRoute;
				if (data.mode != "track") {
					for (const route of [...(this.route ? [this.route] : []), ...Object.values(this.routes)]) {
						if(isEqual(route.routePoints, data.routePoints) && data.mode == route.mode) {
							fromRoute = { ...route, trackPoints: await iterableToArray(this.database.routes.getAllRoutePoints(route.id)) };
							break;
						}
					}
				}

				return await this.api.createLine(this.mapSlug, data, fromRoute);
			},

			editLine: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				let fromRoute;
				if (data.mode != "track") {
					for (const route of [...(this.route ? [this.route] : []), ...Object.values(this.routes)]) {
						if(isEqual(route.routePoints, data.routePoints) && data.mode == route.mode) {
							fromRoute = { ...route, trackPoints: await iterableToArray(this.database.routes.getAllRoutePoints(route.id)) };
							break;
						}
					}
				}

				return await this.api.updateLine(this.mapSlug, data.id, data, fromRoute);
			},

			deleteLine: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const line = await this.api.getLine(this.mapSlug, data.id);
				await this.api.deleteLine(this.mapSlug, data.id);
				return line;
			},

			exportLine: async (data) => {
				this.validatePermissions(Writable.READ);

				if (!this.mapId)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const lineP = this.database.lines.getLine(this.mapId, data.id);
				lineP.catch(() => null); // Avoid unhandled promise error (https://stackoverflow.com/a/59062117/242365)

				const [line, type] = await Promise.all([
					lineP,
					lineP.then((line) => this.database.types.getType(this.mapId as string, line.typeId))
				]);

				switch(data.format) {
					case "gpx-trk":
						return await streamToString(exportLineToTrackGpx(line, type, this.database.lines.getLinePointsForLine(line.id)));
					case "gpx-rte":
						return await streamToString(exportLineToRouteGpx(line, type));
					default:
						throw new Error(getI18n().t("socket.unknown-format"));
				}
			},

			addView: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.api.createView(this.mapSlug, data);
			},

			editView: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.api.updateView(this.mapSlug, data.id, data);
			},

			deleteView: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const view = await this.api.getView(this.mapSlug, data.id);
				await this.api.deleteView(this.mapSlug, data.id);
				return view;
			},

			addType: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.api.createType(this.mapSlug, data);
			},

			editType: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.api.updateType(this.mapSlug, data.id, data);
			},

			deleteType: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const type = await this.api.getType(this.mapSlug, data.id);
				await this.api.deleteType(this.mapSlug, data.id);
				return type;
			},

			find: async (data) => {
				this.validatePermissions(Writable.READ);

				const result = await find(data.query, data.loadUrls);
				if (Array.isArray(result)) {
					return result;
				} else {
					return await streamToString(result.data);
				}
			},

			findOnMap: async (data) => {
				if (!this.mapSlug)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.api.findOnMap(this.mapSlug, data.query);
			},

			getRoute: async (data) => {
				return await this.api.getRoute(data);
			},

			setRoute: async (data) => {
				this.validatePermissions(Writable.READ);

				const existingRoute = data.routeId ? this.routes[data.routeId] : this.route;

				let routeInfo;
				if(existingRoute)
					routeInfo = await this.database.routes.updateRoute(existingRoute.id, data.routePoints, data.mode);
				else
					routeInfo = await this.database.routes.createRoute(data.routePoints, data.mode);

				if(!routeInfo) {
					// A newer submitted route has returned in the meantime
					console.log("Ignoring outdated route");
					return;
				}

				if (data.routeId)
					this.routes[data.routeId] = omit(routeInfo, "trackPoints");
				else
					this.route = omit(routeInfo, "trackPoints");

				if(this.bbox)
					routeInfo.trackPoints = prepareForBoundingBox(routeInfo.trackPoints, this.bbox, true);
				else
					routeInfo.trackPoints = [];

				return {
					routeId: data.routeId,
					top: routeInfo.top,
					left: routeInfo.left,
					bottom: routeInfo.bottom,
					right: routeInfo.right,
					routePoints: routeInfo.routePoints,
					mode: routeInfo.mode,
					time: routeInfo.time,
					distance: routeInfo.distance,
					ascent: routeInfo.ascent,
					descent: routeInfo.descent,
					extraInfo: routeInfo.extraInfo,
					trackPoints: routeInfo.trackPoints
				};
			},

			clearRoute: async (data) => {
				if (data) {
					this.validatePermissions(Writable.READ);
				}

				let route;
				if (data?.routeId != null) {
					route = this.routes[data.routeId];
					delete this.routes[data.routeId];
				} else {
					route = this.route;
					this.route = undefined;
				}

				if (route)
					await this.database.routes.deleteRoute(route.id);
			},

			lineToRoute: async (data) => {
				this.validatePermissions(Writable.READ);

				if (!this.mapId)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const existingRoute = data.routeId ? this.routes[data.routeId] : this.route;
				const routeInfo = await this.database.routes.lineToRoute(existingRoute?.id, this.mapId, data.id);

				if (!routeInfo) {
					// A newer submitted route has returned in the meantime
					console.log("Ignoring outdated route");
					return;
				}

				if (data.routeId)
					this.routes[routeInfo.id] = omit(routeInfo, "trackPoints");
				else
					this.route = omit(routeInfo, "trackPoints");

				if(this.bbox)
					routeInfo.trackPoints = prepareForBoundingBox(routeInfo.trackPoints, this.bbox, true);
				else
					routeInfo.trackPoints = [];

				return {
					routeId: data.routeId,
					top: routeInfo.top,
					left: routeInfo.left,
					bottom: routeInfo.bottom,
					right: routeInfo.right,
					routePoints: routeInfo.routePoints,
					mode: routeInfo.mode,
					time: routeInfo.time,
					distance: routeInfo.distance,
					ascent: routeInfo.ascent,
					descent: routeInfo.descent,
					trackPoints: routeInfo.trackPoints
				};
			},

			exportRoute: async (data) => {
				this.validatePermissions(Writable.READ);

				const route = data.routeId ? this.routes[data.routeId] : this.route;
				if (!route) {
					throw new Error(getI18n().t("route-not-available-error"));
				}

				const routeInfo = { ...route, name: getI18n().t("socket.route-name"), data: {} };

				switch(data.format) {
					case "gpx-trk":
						return await streamToString(exportLineToTrackGpx(routeInfo, undefined, this.database.routes.getAllRoutePoints(route.id)));
					case "gpx-rte":
						return await streamToString(exportLineToRouteGpx(routeInfo, undefined));
					default:
						throw new Error(getI18n().t("socket.unknown-format"));
				}
			},

			listenToHistory: async () => {
				this.validatePermissions(Writable.WRITE);

				if (!this.mapId)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				if(this.listeningToHistory)
					throw new Error(getI18n().t("socket.already-listening-to-history-error"));

				this.listeningToHistory = true;
				this.registerDatabaseHandlers();

				return promiseProps({
					history: iterableToArray(this.database.history.getHistory(this.mapId, this.writable == Writable.ADMIN ? undefined : ["Marker", "Line"]))
				});
			},

			stopListeningToHistory: () => {
				this.validatePermissions(Writable.WRITE);

				if(!this.listeningToHistory)
					throw new Error(getI18n().t("socket.not-listening-to-history-error"));

				this.listeningToHistory = false;
				this.registerDatabaseHandlers();
			},

			revertHistoryEntry: async (data) => {
				if (!this.mapSlug || !this.mapId)
					throw new Error(getI18n().t("socket.no-map-open-error"));

				this.pauseHistoryListener++;

				try {
					await this.api.revertHistoryEntry(this.mapSlug, data.id);
				} finally {
					this.pauseHistoryListener--;
				}

				return promiseProps({
					history: iterableToArray(this.database.history.getHistory(this.mapId, this.writable == Writable.ADMIN ? undefined : ["Marker", "Line"]))
				});
			},

			geoip: async () => {
				return await this.api.geoip();
			}

			/*copyPad : function(data, callback) {
				if(!stripObject(data, { toId: "string" }))
					return callback("Invalid parameters.");

				this.database.copyPad(this.padId, data.toId, callback);
			}*/
		};
	}

	getDatabaseHandlers(): DatabaseHandlers {
		return {
			...(this.mapId ? {
				line: (mapId, data) => {
					if(mapId == this.mapId)
						this.emit("line", data);
				},

				linePoints: (mapId, lineId, trackPoints) => {
					if(mapId == this.mapId)
						this.emit("linePoints", { reset: true, id: lineId, trackPoints : (this.bbox ? prepareForBoundingBox(trackPoints, this.bbox) : [ ]) });
				},

				deleteLine: (mapId, data) => {
					if(mapId == this.mapId)
						this.emit("deleteLine", data);
				},

				marker: (mapId, data) => {
					if(mapId == this.mapId && this.bbox && isInBbox(data, this.bbox))
						this.emit("marker", data);
				},

				deleteMarker: (mapId, data) => {
					if(mapId == this.mapId)
						this.emit("deleteMarker", data);
				},

				type: (mapId, data) => {
					if(mapId == this.mapId)
						this.emit("type", data);
				},

				deleteType: (mapId, data) => {
					if(mapId == this.mapId)
						this.emit("deleteType", data);
				},

				mapData: (mapId, data) => {
					if(mapId == this.mapId) {
						const dataClone = cloneDeep(data);
						if (this.writable === Writable.ADMIN) {
							this.mapSlug = dataClone.adminId;
						} else if (this.writable === Writable.WRITE) {
							delete dataClone.adminId;
							this.mapSlug = dataClone.writeId;
						} else {
							delete dataClone.adminId;
							delete dataClone.writeId;
							this.mapSlug = dataClone.id;
						}

						this.mapId = data.id;

						this.emit("mapData", {
							...dataClone,
							writable: this.writable!
						});
					}
				},

				deleteMap: (mapId) => {
					if (mapId == this.mapId) {
						this.emit("deleteMap");
						this.writable = Writable.READ;
					}
				},

				view: (mapId, data) => {
					if(mapId == this.mapId)
						this.emit("view", data);
				},

				deleteView: (mapId, data) => {
					if(mapId == this.mapId)
						this.emit("deleteView", data);
				},

				...(this.listeningToHistory ? {
					addHistoryEntry: (mapId, data) => {
						if(mapId == this.mapId && (this.writable == Writable.ADMIN || ["Marker", "Line"].includes(data.type)) && !this.pauseHistoryListener)
							this.emit("history", data);
					}
				} : {})

			} : {})
		};
	}

	registerDatabaseHandlers(): void {
		this.unregisterDatabaseHandlers();

		const handlers = this.getDatabaseHandlers();

		for (const eventName of Object.keys(handlers) as Array<EventName<DatabaseEvents>>) {
			this.database.addListener(eventName as any, handlers[eventName] as any);
		}

		this.unregisterDatabaseHandlers = () => {
			for (const eventName of Object.keys(handlers) as Array<EventName<DatabaseEvents>>) {
				this.database.removeListener(eventName as any, handlers[eventName] as any);
			}
		};
	}

}