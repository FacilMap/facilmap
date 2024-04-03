import { promiseProps, type PromiseMap } from "../utils/utils.js";
import { asyncIteratorToArray, streamToString } from "../utils/streams.js";
import { isInBbox } from "../utils/geo.js";
import { Socket, type Socket as SocketIO } from "socket.io";
import { exportLineToRouteGpx, exportLineToTrackGpx } from "../export/gpx.js";
import { find } from "../search.js";
import { geoipLookup } from "../geoip.js";
import { cloneDeep, isEqual, omit } from "lodash-es";
import Database from "../database/database.js";
import { type Bbox, type BboxWithZoom, type SocketEvents, type MultipleEvents, type PadData, type PadId, SocketVersion, Writable, type SocketClientToServerEvents, type SocketServerToClientEvents, PadNotFoundError } from "facilmap-types";
import { calculateRoute, prepareForBoundingBox } from "../routing/routing.js";
import type { RouteWithId } from "../database/route.js";
import { SocketConnection, type DatabaseHandlers, type SocketHandlers } from "./socket-common";
import { getI18n } from "../i18n.js";

export type MultipleEventPromises = {
	[eventName in keyof MultipleEvents<SocketEvents<SocketVersion.V2>>]: PromiseLike<MultipleEvents<SocketEvents<SocketVersion.V2>>[eventName]> | MultipleEvents<SocketEvents<SocketVersion.V2>>[eventName];
}

function isPadId(padId: PadId | true | undefined): padId is PadId {
	return !!(padId && padId !== true);
}

export class SocketConnectionV2 extends SocketConnection {

	declare socket: Socket<SocketClientToServerEvents<SocketVersion.V2>, SocketServerToClientEvents<SocketVersion.V2>>;
	padId: PadId | true | undefined = undefined;
	bbox: BboxWithZoom | undefined = undefined;
	writable: Writable | undefined = undefined;
	route: Omit<RouteWithId, "trackPoints"> | undefined = undefined;
	routes: Record<string, Omit<RouteWithId, "trackPoints">> = { };
	listeningToHistory = false;
	pauseHistoryListener = 0;

	constructor(socket: SocketIO<SocketClientToServerEvents<SocketVersion.V2>, SocketServerToClientEvents<SocketVersion.V2>>, database: Database) {
		super(socket, database);
	}

	override getVersion(): SocketVersion {
		return SocketVersion.V2;
	}

	getPadObjects(padData: PadData & { writable: Writable }): Promise<MultipleEvents<SocketEvents<SocketVersion.V2>>> {
		const promises: PromiseMap<MultipleEvents<SocketEvents<SocketVersion.V2>>> = {
			padData: [ padData ],
			view: asyncIteratorToArray(this.database.views.getViews(padData.id)),
			type: asyncIteratorToArray(this.database.types.getTypes(padData.id)),
			line: asyncIteratorToArray(this.database.lines.getPadLines(padData.id))
		};

		if(this.bbox) { // In case bbox is set while fetching pad data
			Object.assign(promises, {
				marker: asyncIteratorToArray(this.database.markers.getPadMarkers(padData.id, this.bbox)),
				linePoints: asyncIteratorToArray(this.database.lines.getLinePointsForPad(padData.id, this.bbox))
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

	override handleDisconnect(): void {
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
	};

	override getSocketHandlers(): SocketHandlers<SocketVersion.V2> {
		return {
			setPadId: async (padId) => {
				if(this.padId != null)
					throw new Error(getI18n().t("socket.pad-id-set-error"));

				this.padId = true;

				const [admin, write, read] = await Promise.all([
					this.database.pads.getPadDataByAdminId(padId),
					this.database.pads.getPadDataByWriteId(padId),
					this.database.pads.getPadData(padId)
				]);

				let pad;
				if(admin)
					pad = { ...admin, writable: Writable.ADMIN };
				else if(write)
					pad = omit({ ...write, writable: Writable.WRITE }, ["adminId"]);
				else if(read)
					pad = omit({ ...read, writable: Writable.READ }, ["writeId", "adminId"]);
				else {
					this.padId = undefined;
					throw new PadNotFoundError(getI18n().t("socket.pad-not-exist-error"));
				}

				this.padId = pad.id;
				this.writable = pad.writable;

				this.registerDatabaseHandlers();

				return await this.getPadObjects(pad);
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

				if(this.padId && this.padId !== true) {
					ret.marker = asyncIteratorToArray(this.database.markers.getPadMarkers(this.padId, markerBboxWithExcept));
					ret.linePoints = asyncIteratorToArray(this.database.lines.getLinePointsForPad(this.padId, lineBboxWithExcept));
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

				const padData = await this.database.pads.getPadDataByAnyId(data.padId);
				return padData && {
					id: padData.id,
					name: padData.name,
					description: padData.description
				};
			},

			findPads: async (data) => {
				this.validatePermissions(Writable.READ);

				return this.database.pads.findPads(data);
			},

			createPad: async (data) => {
				this.validatePermissions(Writable.READ);

				if(this.padId)
					throw new Error(getI18n().t("socket.pad-already-loaded-error"));

				const padData = await this.database.pads.createPad(data);

				this.padId = padData.id;
				this.writable = Writable.ADMIN;

				this.registerDatabaseHandlers();

				return await this.getPadObjects({ ...padData, writable: Writable.ADMIN });
			},

			editPad: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return {
					...await this.database.pads.updatePadData(this.padId, data),
					writable: this.writable!
				};
			},

			deletePad: async () => {
				this.validatePermissions(Writable.ADMIN);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				await this.database.pads.deletePad(this.padId);
			},

			getMarker: async (data) => {
				this.validatePermissions(Writable.READ);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.markers.getMarker(this.padId, data.id);
			},

			addMarker: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.markers.createMarker(this.padId, data);
			},

			editMarker: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return this.database.markers.updateMarker(this.padId, data.id, data);
			},

			deleteMarker: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return this.database.markers.deleteMarker(this.padId, data.id);
			},

			getLineTemplate: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.lines.getLineTemplate(this.padId, data);
			},

			addLine: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isPadId(this.padId))
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

				return await this.database.lines.createLine(this.padId, data, fromRoute);
			},

			editLine: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isPadId(this.padId))
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

				return await this.database.lines.updateLine(this.padId, data.id, data, undefined, fromRoute);
			},

			deleteLine: async (data) => {
				this.validatePermissions(Writable.WRITE);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return this.database.lines.deleteLine(this.padId, data.id);
			},

			exportLine: async (data) => {
				this.validatePermissions(Writable.READ);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const lineP = this.database.lines.getLine(this.padId, data.id);
				lineP.catch(() => null); // Avoid unhandled promise error (https://stackoverflow.com/a/59062117/242365)

				const [line, type] = await Promise.all([
					lineP,
					lineP.then((line) => this.database.types.getType(this.padId as string, line.typeId))
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

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.views.createView(this.padId, data);
			},

			editView: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.views.updateView(this.padId, data.id, data);
			},

			deleteView: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.views.deleteView(this.padId, data.id);
			},

			addType: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.types.createType(this.padId, data);
			},

			editType: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.types.updateType(this.padId, data.id, data);
			},

			deleteType: async (data) => {
				this.validatePermissions(Writable.ADMIN);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.types.deleteType(this.padId, data.id);
			},

			find: async (data) => {
				this.validatePermissions(Writable.READ);

				return await find(data.query, data.loadUrls);
			},

			findOnMap: async (data) => {
				this.validatePermissions(Writable.READ);

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				return await this.database.search.search(this.padId, data.query);
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

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const existingRoute = data.routeId ? this.routes[data.routeId] : this.route;
				const routeInfo = await this.database.routes.lineToRoute(existingRoute?.id, this.padId, data.id);

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

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				if(this.listeningToHistory)
					throw new Error(getI18n().t("socket.already-listening-to-history-error"));

				this.listeningToHistory = true;
				this.registerDatabaseHandlers();

				return promiseProps({
					history: asyncIteratorToArray(this.database.history.getHistory(this.padId, this.writable == Writable.ADMIN ? undefined : ["Marker", "Line"]))
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

				if (!isPadId(this.padId))
					throw new Error(getI18n().t("socket.no-map-open-error"));

				const historyEntry = await this.database.history.getHistoryEntry(this.padId, data.id);

				if(!["Marker", "Line"].includes(historyEntry.type) && this.writable != Writable.ADMIN)
					throw new Error(getI18n().t("socket.admin-revert-error"));

				this.pauseHistoryListener++;

				try {
					await this.database.history.revertHistoryEntry(this.padId, data.id);
				} finally {
					this.pauseHistoryListener--;
				}

				return promiseProps({
					history: asyncIteratorToArray(this.database.history.getHistory(this.padId, this.writable == Writable.ADMIN ? undefined : ["Marker", "Line"]))
				});
			},

			geoip: async () => {
				const ip = (this.socket.handshake.headers as Record<string, string>)["x-forwarded-for"] || this.socket.request.connection.remoteAddress;
				return ip ? await geoipLookup(ip) : undefined;
			}

			/*copyPad : function(data, callback) {
				if(!stripObject(data, { toId: "string" }))
					return callback("Invalid parameters.");

				this.database.copyPad(this.padId, data.toId, callback);
			}*/
		};
	}

	override getDatabaseHandlers(): DatabaseHandlers {
		return {
			...(this.padId ? {
				line: (padId, data) => {
					if(padId == this.padId)
						this.socket.emit("line", data);
				},

				linePoints: (padId, lineId, trackPoints) => {
					if(padId == this.padId)
						this.socket.emit("linePoints", { reset: true, id: lineId, trackPoints : (this.bbox ? prepareForBoundingBox(trackPoints, this.bbox) : [ ]) });
				},

				deleteLine: (padId, data) => {
					if(padId == this.padId)
						this.socket.emit("deleteLine", data);
				},

				marker: (padId, data) => {
					if(padId == this.padId && this.bbox && isInBbox(data, this.bbox))
						this.socket.emit("marker", data);
				},

				deleteMarker: (padId, data) => {
					if(padId == this.padId)
						this.socket.emit("deleteMarker", data);
				},

				type: (padId, data) => {
					if(padId == this.padId)
						this.socket.emit("type", data);
				},

				deleteType: (padId, data) => {
					if(padId == this.padId)
						this.socket.emit("deleteType", data);
				},

				padData: (padId, data) => {
					if(padId == this.padId) {
						const dataClone = cloneDeep(data);
						if(this.writable == Writable.READ)
							delete dataClone.writeId;
						if(this.writable != Writable.ADMIN)
							delete dataClone.adminId;

						this.padId = data.id;

						this.socket.emit("padData", {
							...dataClone,
							writable: this.writable!
						});
					}
				},

				deletePad: (padId) => {
					if (padId == this.padId) {
						this.socket.emit("deletePad");
						this.writable = Writable.READ;
					}
				},

				view: (padId, data) => {
					if(padId == this.padId)
						this.socket.emit("view", data);
				},

				deleteView: (padId, data) => {
					if(padId == this.padId)
						this.socket.emit("deleteView", data);
				},

				...(this.listeningToHistory ? {
					addHistoryEntry: (padId, data) => {
						if(padId == this.padId && (this.writable == Writable.ADMIN || ["Marker", "Line"].includes(data.type)) && !this.pauseHistoryListener)
							this.socket.emit("history", data);
					}
				} : {})

			} : {})
		};
	}

}