import { promiseProps, type PromiseMap } from "../utils/utils.js";
import { asyncIteratorToArray, streamToString } from "../utils/streams.js";
import { isInBbox } from "../utils/geo.js";
import { exportLineToRouteGpx, exportLineToTrackGpx } from "../export/gpx.js";
import { find } from "../search.js";
import { geoipLookup } from "../geoip.js";
import { cloneDeep, isEqual, omit } from "lodash-es";
import Database, { type DatabaseEvents } from "../database/database.js";
import { type Bbox, type BboxWithZoom, type SocketEvents, type MultipleEvents, type MapData, type MapId, SocketVersion, Writable, PadNotFoundError, type SocketServerToClientEmitArgs, type EventName } from "facilmap-types";
import { calculateRoute, prepareForBoundingBox } from "../routing/routing.js";
import type { RouteWithId } from "../database/route.js";
import { type SocketConnection, type DatabaseHandlers, type SocketHandlers } from "./socket-common.js";
import { getI18n, setDomainUnits } from "../i18n.js";

export type MultipleEventPromises = {
	[eventName in keyof MultipleEvents<SocketEvents<SocketVersion.V3>>]: PromiseLike<MultipleEvents<SocketEvents<SocketVersion.V3>>[eventName]> | MultipleEvents<SocketEvents<SocketVersion.V3>>[eventName];
}

function isMapId(mapId: MapId | true | undefined): mapId is MapId {
	return !!(mapId && mapId !== true);
}

export class SocketConnectionV3 implements SocketConnection<SocketVersion.V3> {

	emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V3>) => void;
	database: Database;
	remoteAddr: string;

	mapId: MapId | true | undefined = undefined;
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

		this.registerDatabaseHandlers();
	}

	getMapObjects(mapData: MapData & { writable: Writable }): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		const promises: PromiseMap<MultipleEvents<SocketEvents<SocketVersion.V3>>> = {
			mapData: [ mapData ],
			view: asyncIteratorToArray(this.database.views.getViews(mapData.id)),
			type: asyncIteratorToArray(this.database.types.getTypes(mapData.id)),
			line: asyncIteratorToArray(this.database.lines.getMapLines(mapData.id))
		};

		if(this.bbox) { // In case bbox is set while fetching map data
			Object.assign(promises, {
				marker: asyncIteratorToArray(this.database.markers.getMapMarkers(mapData.id, this.bbox)),
				linePoints: asyncIteratorToArray(this.database.lines.getLinePointsForMap(mapData.id, this.bbox))
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
			setPadId: async (mapId) => {
				if(this.mapId != null)
					throw new Error(getI18n().t("socket.map-id-set-error"));

				this.mapId = true;

				const [admin, write, read] = await Promise.all([
					this.database.maps.getMapDataByAdminId(mapId),
					this.database.maps.getMapDataByWriteId(mapId),
					this.database.maps.getMapData(mapId)
				]);

				let map;
				if(admin)
					map = { ...admin, writable: Writable.ADMIN };
				else if(write)
					map = omit({ ...write, writable: Writable.WRITE }, ["adminId"]);
				else if(read)
					map = omit({ ...read, writable: Writable.READ }, ["writeId", "adminId"]);
				else {
					this.mapId = undefined;
					throw new PadNotFoundError(getI18n().t("socket.map-not-exist-error"));
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

				if(this.mapId && this.mapId !== true) {
					ret.marker = asyncIteratorToArray(this.database.markers.getMapMarkers(this.mapId, markerBboxWithExcept));
					ret.linePoints = asyncIteratorToArray(this.database.lines.getLinePointsForMap(this.mapId, lineBboxWithExcept));
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

			getPad: async (data) => {
				this.validatePermissions(Writable.READ);

				const mapData = await this.database.maps.getMapDataByAnyId(data.padId);
				return mapData && {
					id: mapData.id,
					name: mapData.name,
					description: mapData.description
				};
			},

			findPads: async (data) => {
				this.validatePermissions(Writable.READ);

				return this.database.maps.findMaps(data);
			},

			createPad: async (data) => {
				this.validatePermissions(Writable.READ);

				if(this.mapId)
					throw new Error(getI18n().t("socket.map-already-loaded-error"));

				const mapData = await this.database.maps.createMap(data);

				this.mapId = mapData.id;
				this.writable = Writable.ADMIN;

				this.registerDatabaseHandlers();

				return await this.getMapObjects({ ...mapData, writable: Writable.ADMIN });
			},

			editPad: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return {
					...await this.database.maps.updateMapData(this.mapId, data),
					writable: this.writable!
				};
			},

			deletePad: async () => {
				this.validatePermissions(Writable.ADMIN);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				await this.database.maps.deleteMap(this.mapId);
			},

			getMarker: async (data) => {
				this.validatePermissions(Writable.READ);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.markers.getMarker(this.mapId, data.id);
			},

			addMarker: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.markers.createMarker(this.mapId, data);
			},

			editMarker: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return this.database.markers.updateMarker(this.mapId, data.id, data);
			},

			deleteMarker: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return this.database.markers.deleteMarker(this.mapId, data.id);
			},

			getLineTemplate: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.lines.getLineTemplate(this.mapId, data);
			},

			addLine: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				let fromRoute;
				if (data.mode != "track") {
					for (const route of [...(this.route ? [this.route] : []), ...Object.values(this.routes)]) {
						if(isEqual(route.routePoints, data.routePoints) && data.mode == route.mode) {
							fromRoute = { ...route, trackPoints: await asyncIteratorToArray(this.database.routes.getAllRoutePoints(route.id)) };
							break;
						}
					}
				}

				return await this.database.lines.createLine(this.mapId, data, fromRoute);
			},

			editLine: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				let fromRoute;
				if (data.mode != "track") {
					for (const route of [...(this.route ? [this.route] : []), ...Object.values(this.routes)]) {
						if(isEqual(route.routePoints, data.routePoints) && data.mode == route.mode) {
							fromRoute = { ...route, trackPoints: await asyncIteratorToArray(this.database.routes.getAllRoutePoints(route.id)) };
							break;
						}
					}
				}

				return await this.database.lines.updateLine(this.mapId, data.id, data, undefined, fromRoute);
			},

			deleteLine: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return this.database.lines.deleteLine(this.mapId, data.id);
			},

			exportLine: async (data) => {
				this.validatePermissions(Writable.READ);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const lineP = this.database.lines.getLine(this.mapId, data.id);
				lineP.catch(() => null); // Avoid unhandled promise error (https://stackoverflow.com/a/59062117/242365)

				const [line, type] = await Promise.all([
					lineP,
					lineP.then((line) => this.database.types.getType(this.mapId as string, line.typeId))
				]);

				switch(data.format) {
					case "gpx-trk":
						return await streamToString(exportLineToTrackGpx(line, type, this.database.lines.getAllLinePoints(line.id)));
					case "gpx-rte":
						return await streamToString(exportLineToRouteGpx(line, type));
					default:
						throw new Error(getI18n().t("socket.unknown-format"));
				}
			},

			addView: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.views.createView(this.mapId, data);
			},

			editView: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.views.updateView(this.mapId, data.id, data);
			},

			deleteView: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.views.deleteView(this.mapId, data.id);
			},

			addType: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.types.createType(this.mapId, data);
			},

			editType: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.types.updateType(this.mapId, data.id, data);
			},

			deleteType: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.types.deleteType(this.mapId, data.id);
			},

			find: async (data) => {
				this.validatePermissions(Writable.READ);

				return await find(data.query, data.loadUrls);
			},

			findOnMap: async (data) => {
				this.validatePermissions(Writable.READ);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.search.search(this.mapId, data.query);
			},

			getRoute: async (data) => {
				this.validatePermissions(Writable.READ);

				return await calculateRoute(data.destinations, data.mode);
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

				if (!isMapId(this.mapId))
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

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				if(this.listeningToHistory)
					throw new Error(getI18n().t("socket.already-listening-to-history-error"));

				this.listeningToHistory = true;
				this.registerDatabaseHandlers();

				return promiseProps({
					history: asyncIteratorToArray(this.database.history.getHistory(this.mapId, this.writable == Writable.ADMIN ? undefined : ["Marker", "Line"]))
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
				this.validatePermissions(Writable.WRITE);

				if (!isMapId(this.mapId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const historyEntry = await this.database.history.getHistoryEntry(this.mapId, data.id);

				if(!["Marker", "Line"].includes(historyEntry.type) && this.writable != Writable.ADMIN)
					throw new Error(getI18n().t("socket.admin-revert-error"));

				this.pauseHistoryListener++;

				try {
					await this.database.history.revertHistoryEntry(this.mapId, data.id);
				} finally {
					this.pauseHistoryListener--;
				}

				return promiseProps({
					history: asyncIteratorToArray(this.database.history.getHistory(this.mapId, this.writable == Writable.ADMIN ? undefined : ["Marker", "Line"]))
				});
			},

			geoip: async () => {
				return await geoipLookup(this.remoteAddr);
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
						if(this.writable == Writable.READ)
							delete dataClone.writeId;
						if(this.writable != Writable.ADMIN)
							delete dataClone.adminId;

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