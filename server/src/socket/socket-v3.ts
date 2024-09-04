import { generateRandomId } from "../utils/utils.js";
import { iterableToArray, streamToIterable } from "../utils/streams.js";
import { isInBbox } from "../utils/geo.js";
import { exportLineToRouteGpx, exportLineToTrackGpx } from "../export/gpx.js";
import { isEqual, omit } from "lodash-es";
import Database, { type DatabaseEvents } from "../database/database.js";
import { type BboxWithZoom, SocketVersion, Writable, type SocketServerToClientEmitArgs, type EventName, type MapSlug, type StreamId, type StreamToStreamId, type StreamedResults, type SubscribeToMapPick, type Route, type BboxWithExcept, DEFAULT_PAGING, type ID } from "facilmap-types";
import { prepareForBoundingBox } from "../routing/routing.js";
import { type SocketConnection, type DatabaseHandlers, type SocketHandlers } from "./socket-common.js";
import { getI18n, setDomainUnits } from "../i18n.js";
import { ApiV3Backend } from "../api/api-v3.js";
import { getMapDataWithWritable, getMapSlug, getSafeFilename, numberEntries } from "facilmap-utils";
import { serializeError } from "serialize-error";

export class SocketConnectionV3 implements SocketConnection<SocketVersion.V3> {

	emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V3>) => void;
	database: Database;
	remoteAddr: string;
	api: ApiV3Backend;

	bbox: BboxWithZoom | undefined = undefined;
	mapSubscriptions: Record<ID, Array<{ pick: SubscribeToMapPick[]; history: boolean; mapSlug: MapSlug; writable: Writable }>> = {};
	routeSubscriptions: Record<string, Route & { routeId: string }> = { };

	unregisterDatabaseHandlers = (): void => undefined;

	constructor(emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V3>) => void, database: Database, remoteAddr: string) {
		this.emit = emit;
		this.database = database;
		this.remoteAddr = remoteAddr;
		this.api = new ApiV3Backend(database, remoteAddr);

		this.registerDatabaseHandlers();
	}

	handleDisconnect(): void {
		for (const routeKey of Object.keys(this.routeSubscriptions)) {
			this.database.routes.deleteRoute(this.routeSubscriptions[routeKey].routeId).catch((err) => {
				console.error("Error clearing route", err);
			});
		}

		this.unregisterDatabaseHandlers();
	};

	emitStream<T>(stream: AsyncIterable<T>): StreamId<T> {
		const streamId = `${generateRandomId(8)}-${Date.now()}` as StreamId<T>;
		void (async () => {
			let chunks: any[] = [];
			let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
			let done = false;
			try {
				for await (const chunk of stream) {
					chunks.push(chunk);
					if (!timeout) {
						timeout = setTimeout(() => {
							this.emit("streamChunks", streamId, chunks);
							chunks = [];
							timeout = undefined;

							if (done) {
								this.emit("streamDone", streamId);
							}
						});
					}
				}
				done = true;
				if (!timeout) {
					this.emit("streamDone", streamId);
				}
			} catch (err: any) {
				this.emit("streamError", streamId, serializeError(err));
			}
		})();
		return streamId;
	}

	emitStreamedResults<T>(results: StreamedResults<T>): StreamToStreamId<StreamedResults<T>> {
		return {
			results: this.emitStream<any>(results.results)
		};
	}

	getSocketHandlers(): SocketHandlers<SocketVersion.V3> {
		return {
			setLanguage: async (settings) => {
				if (settings.lang) {
					await getI18n().changeLanguage(settings.lang);
				}
				if (settings.units) {
					setDomainUnits(settings.units);
				}
			},

			findMaps: async (query, paging = DEFAULT_PAGING) => {
				return await this.api.findMaps(query, paging);
			},

			getMap: async (mapSlug) => {
				return await this.database.maps.getMapDataBySlug(mapSlug, Writable.READ);
			},

			createMap: async (data, options = {}) => {
				const results = await this.api.createMap(data, options);
				type This = this;
				return this.emitStream((async function*(this: This) {
					for await (const obj of results) {
						if (obj.type === "mapData") {
							yield obj;
						} else {
							yield { ...obj, data: this.emitStream<any>(obj.data) };
						}
					}
				}).call(this));
			},

			updateMap: async (mapSlug, data) => {
				return await this.api.updateMap(mapSlug, data);
			},

			deleteMap: async (mapSlug) => {
				await this.api.deleteMap(mapSlug);
			},

			getAllMapObjects: async (mapSlug, options) => {
				const results = await this.api.getAllMapObjects(mapSlug, options);
				type This = this;
				return this.emitStream((async function*(this: This) {
					for await (const obj of results) {
						if (obj.type === "mapData") {
							yield obj;
						} else {
							yield { ...obj, data: this.emitStream<any>(obj.data) };
						}
					}
				}).call(this));
			},

			findOnMap: async (mapSlug, query) => {
				return await this.api.findOnMap(mapSlug, query);
			},

			getHistory: async (mapSlug, paging = DEFAULT_PAGING) => {
				return await this.api.getHistory(mapSlug, paging);
			},

			revertHistoryEntry: async (mapSlug, historyEntryId) => {
				await this.api.revertHistoryEntry(mapSlug, historyEntryId);
			},

			getMapMarkers: async (mapSlug, options = {}) => {
				return this.emitStreamedResults(await this.api.getMapMarkers(mapSlug, options));
			},

			getMarker: async (mapSlug, markerId) => {
				return await this.api.getMarker(mapSlug, markerId);
			},

			createMarker: async (mapSlug, data) => {
				return await this.api.createMarker(mapSlug, data);
			},

			updateMarker: async (mapSlug, markerId, data) => {
				return await this.api.updateMarker(mapSlug, markerId, data);
			},

			deleteMarker: async (mapSlug, markerId) => {
				await this.api.deleteMarker(mapSlug, markerId);
			},

			getMapLines: async (mapSlug, options) => {
				return this.emitStreamedResults(await this.api.getMapLines(mapSlug, options));
			},

			getLine: async (mapSlug, lineId) => {
				return await this.api.getLine(mapSlug, lineId);
			},

			getLinePoints: async (mapSlug, lineId, options) => {
				return this.emitStreamedResults(await this.api.getLinePoints(mapSlug, lineId, options));
			},

			createLine: async (mapSlug, data) => {
				let fromRoute;
				if (data.mode != "track") {
					for (const route of Object.values(this.routeSubscriptions)) {
						if(isEqual(route.routePoints, data.routePoints) && data.mode == route.mode) {
							fromRoute = { ...route, trackPoints: await iterableToArray(this.database.routes.getAllRoutePoints(route.routeId)) };
							break;
						}
					}
				}

				return await this.api.createLine(mapSlug, data, fromRoute);
			},

			updateLine: async (mapSlug, lineId, data) => {
				let fromRoute;
				if (data.mode != "track") {
					for (const route of Object.values(this.routeSubscriptions)) {
						if(isEqual(route.routePoints, data.routePoints) && data.mode == route.mode) {
							fromRoute = { ...route, trackPoints: await iterableToArray(this.database.routes.getAllRoutePoints(route.routeId)) };
							break;
						}
					}
				}

				return await this.api.updateLine(mapSlug, lineId, data, fromRoute);
			},

			deleteLine: async (mapSlug, lineId) => {
				await this.api.deleteLine(mapSlug, lineId);
			},

			exportLine: async (mapSlug, lineId, options) => {
				const result = await this.api.exportLine(mapSlug, lineId, options);
				return {
					...result,
					data: this.emitStream(streamToIterable(result.data))
				};
			},

			getMapTypes: async (mapSlug) => {
				return this.emitStreamedResults(await this.api.getMapTypes(mapSlug));
			},

			getType: async (mapSlug, id) => {
				return await this.api.getType(mapSlug, id);
			},

			createType: async (mapSlug, data) => {
				return await this.api.createType(mapSlug, data);
			},

			updateType: async (mapSlug, typeId, data) => {
				return await this.api.updateType(mapSlug, typeId, data);
			},

			deleteType: async (mapSlug, typeId) => {
				await this.api.deleteType(mapSlug, typeId);
			},

			getMapViews: async (mapSlug) => {
				return this.emitStreamedResults(await this.api.getMapViews(mapSlug));
			},

			getView: async (mapSlug, viewId) => {
				return await this.api.getView(mapSlug, viewId);
			},

			createView: async (mapSlug, data) => {
				return await this.api.createView(mapSlug, data);
			},

			updateView: async (mapSlug, viewId, data) => {
				return await this.api.updateView(mapSlug, viewId, data);
			},

			deleteView: async (mapSlug, viewId) => {
				await this.api.deleteView(mapSlug, viewId);
			},

			find: async (query) => {
				return await this.api.find(query);
			},

			findUrl: async (url) => {
				const result = await this.api.findUrl(url);
				return {
					data: this.emitStream(streamToIterable(result.data))
				};
			},

			getRoute: async (data) => {
				return await this.api.getRoute(data);
			},

			geoip: async () => {
				return await this.api.geoip();
			},

			subscribeToMap: async (mapSlug, { pick = ["mapData" as const, "markers" as const, "lines" as const, "linePoints" as const, "types" as const, "views" as const], history = false } = {}) => {
				const subscription = Object.values(this.mapSubscriptions).flat().find((s) => s.mapSlug === mapSlug);
				const pickBefore = subscription?.pick;
				if (!subscription) {
					const mapData = await this.api.getMap(mapSlug);
					if (!this.mapSubscriptions[mapData.id]) {
						this.mapSubscriptions[mapData.id] = [];
					}
					this.mapSubscriptions[mapData.id].push({ pick, history, mapSlug, writable: mapData.writable });
				}

				const newPick = pickBefore ? pick.filter((p) => !pickBefore.includes(p)) : pick;
				const results = await this.api.getAllMapObjects(mapSlug, {
					pick: this.bbox ? newPick : newPick.filter((p) => !["markers", "linePoints"].includes(p))
				});

				for await (const obj of results) {
					if (obj.type === "mapData") {
						this.emit("mapData", mapSlug, obj.data);
					} else if (obj.type === "markers") {
						for await (const marker of obj.data) {
							this.emit("marker", mapSlug, marker);
						}
					} else if (obj.type === "lines") {
						for await (const line of obj.data) {
							this.emit("line", mapSlug, line);
						}
					} else if (obj.type === "linePoints") {
						for await (const linePoints of obj.data) {
							this.emit("linePoints", mapSlug, { ...linePoints, reset: true });
						}
					} else if (obj.type === "types") {
						for await (const type of obj.data) {
							this.emit("type", mapSlug, type);
						}
					} else if (obj.type === "views") {
						for await (const view of obj.data) {
							this.emit("view", mapSlug, view);
						}
					}
				}
			},

			unsubscribeFromMap: async (mapSlug) => {
				for (const [mapId, subs] of numberEntries(this.mapSubscriptions)) {
					const without = subs.filter((s) => s.mapSlug !== mapSlug);
					if (without.length !== subs.length) {
						if (without.length === 0) {
							delete this.mapSubscriptions[mapId];
						} else {
							this.mapSubscriptions[mapId] = without;
						}
						return;
					}
				}

				throw new Error(getI18n().t("socket.map-not-subscribed-error", { mapSlug }));
			},

			subscribeToRoute: async (routeKey, params) => {
				const existingRoute = this.routeSubscriptions[routeKey];

				let routeInfo;
				if ("lineId" in params) {
					const mapData = await this.api.getMap(params.mapSlug);
					routeInfo = await this.database.routes.lineToRoute(existingRoute?.routeId, mapData.id, params.lineId);
				} else if (existingRoute) {
					routeInfo = await this.database.routes.updateRoute(existingRoute.routeId, params.routePoints, params.mode);
				} else {
					routeInfo = await this.database.routes.createRoute(params.routePoints, params.mode);
				}

				if(!routeInfo) {
					// A newer submitted route has returned in the meantime
					console.log("Ignoring outdated route");
					return;
				}

				this.routeSubscriptions[routeKey] = omit(routeInfo, ["trackPoints"]);

				this.emit("route", routeKey, omit(routeInfo, ["trackPoints", "routeId"]));

				if(this.bbox) {
					this.emit("routePoints", routeKey, {
						trackPoints: prepareForBoundingBox(routeInfo.trackPoints, this.bbox, true),
						reset: true
					});
				}
			},

			unsubscribeFromRoute: async (routeKey) => {
				if (!this.routeSubscriptions[routeKey]) {
					throw new Error(getI18n().t("socket.route-not-subscribed-error", { routeKey }));
				}

				await this.database.routes.deleteRoute(this.routeSubscriptions[routeKey].routeId);
				delete this.routeSubscriptions[routeKey];
			},

			exportRoute: async (routeId, options) => {
				const route = this.routeSubscriptions[routeId];
				if (!route) {
					throw new Error(getI18n().t("socket.route-not-available-error"));
				}

				const routeInfo = { ...route, name: getI18n().t("socket.route-name"), data: {} };
				const filename = getSafeFilename(routeInfo.name);

				switch(options.format) {
					case "gpx-trk":
						return {
							type: "application/gpx+xml",
							filename: `${filename}.gpx`,
							data: this.emitStream(streamToIterable(exportLineToTrackGpx(routeInfo, undefined, this.database.routes.getAllRoutePoints(route.routeId))))
						};
					case "gpx-rte":
						return {
							type: "application/gpx+xml",
							filename: `${filename}.gpx`,
							data: this.emitStream(streamToIterable(exportLineToRouteGpx(routeInfo, undefined)))
						};
					default:
						throw new Error(getI18n().t("socket.unknown-format"));
				}
			},

			setBbox: async (bbox) => {
				const markerBboxWithExcept: BboxWithExcept = { ...bbox };
				const lineBboxWithExcept: BboxWithExcept = { ...bbox };
				if(this.bbox) {
					markerBboxWithExcept.except = this.bbox;
					if (bbox.zoom == this.bbox.zoom) {
						lineBboxWithExcept.except = this.bbox;
					}
				}

				this.bbox = bbox;

				for (const subs of Object.values(this.mapSubscriptions)) {
					for (const sub of subs) {
						const markerObjs = await this.api.getAllMapObjects(sub.mapSlug, { pick: ["markers"], bbox: markerBboxWithExcept });
						for await (const obj of markerObjs) {
							for await (const marker of obj.data) {
								this.emit("marker", sub.mapSlug, marker);
							}
						}

						const lineObjs = await this.api.getAllMapObjects(sub.mapSlug, { pick: ["linePoints"], bbox: lineBboxWithExcept });
						for await (const obj of lineObjs) {
							for await (const linePoints of obj.data) {
								this.emit("linePoints", sub.mapSlug, { ...linePoints, reset: false });
							}
						}
					}
				}

				for (const [routeKey, sub] of Object.entries(this.routeSubscriptions)) {
					const trackPoints = await this.database.routes.getRoutePoints(sub.routeId, lineBboxWithExcept, !lineBboxWithExcept.except);
					this.emit("routePoints", routeKey, { trackPoints, reset: false });
				}
			},

			/*copyPad : function(data, callback) {
				if(!stripObject(data, { toId: "string" }))
					return callback("Invalid parameters.");

				this.database.copyPad(this.padId, data.toId, callback);
			}*/
		};
	}

	getDatabaseHandlers(): DatabaseHandlers {
		return {
			...(Object.keys(this.mapSubscriptions).length > 0 ? {
				mapData: (mapId, data) => {
					if (this.mapSubscriptions[mapId]) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.pick.includes("mapData")) {
								this.emit("mapData", sub.mapSlug, getMapDataWithWritable(data, sub.writable));
							}
						}

						const slugMap = Object.fromEntries(this.mapSubscriptions[mapId].flatMap((sub) => {
							const oldSlug = sub.mapSlug;
							const newSlug = getMapSlug({ ...data, writable: sub.writable });
							if (oldSlug !== newSlug) {
								sub.mapSlug = newSlug;
								return [[oldSlug, newSlug]];
							} else {
								return [];
							}
						}));

						if (Object.keys(slugMap).length > 0) {
							this.emit("mapSlugRename", slugMap);
						}

						if (data.id !== mapId) {
							this.mapSubscriptions[data.id] = [
								...this.mapSubscriptions[data.id] ?? [],
								...this.mapSubscriptions[mapId]
							];
							delete this.mapSubscriptions[mapId];
						}
					}
				},

				deleteMap: (mapId) => {
					if (this.mapSubscriptions[mapId]) {
						for (const sub of this.mapSubscriptions[mapId]) {
							this.emit("deleteMap", sub.mapSlug);
						}
					}
				},

				marker: (mapId, marker) => {
					if (this.mapSubscriptions[mapId] && this.bbox && isInBbox(marker, this.bbox)) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.pick.includes("markers")) {
								this.emit("marker", sub.mapSlug, marker);
							}
						}
					}
				},

				deleteMarker: (mapId, data) => {
					if (this.mapSubscriptions[mapId]) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.pick.includes("markers")) {
								this.emit("deleteMarker", sub.mapSlug, data);
							}
						}
					}
				},

				line: (mapId, line) => {
					if (this.mapSubscriptions[mapId]) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.pick.includes("lines")) {
								this.emit("line", sub.mapSlug, line);
							}
						}
					}
				},

				linePoints: (mapId, lineId, trackPoints) => {
					if (this.mapSubscriptions[mapId] && this.bbox) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.pick.includes("linePoints")) {
								this.emit("linePoints", sub.mapSlug, {
									lineId,
									// Emit track points even if none are in the bbox so that client resets cached track points
									trackPoints: prepareForBoundingBox(trackPoints, this.bbox),
									reset: true
								});
							}
						}
					}
				},

				deleteLine: (mapId, data) => {
					if (this.mapSubscriptions[mapId]) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.pick.includes("lines")) {
								this.emit("deleteLine", sub.mapSlug, data);
							}
						}
					}
				},

				type: (mapId, data) => {
					if (this.mapSubscriptions[mapId]) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.pick.includes("types")) {
								this.emit("type", sub.mapSlug, data);
							}
						}
					}
				},

				deleteType: (mapId, data) => {
					if (this.mapSubscriptions[mapId]) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.pick.includes("types")) {
								this.emit("deleteType", sub.mapSlug, data);
							}
						}
					}
				},

				view: (mapId, data) => {
					if (this.mapSubscriptions[mapId]) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.pick.includes("views")) {
								this.emit("view", sub.mapSlug, data);
							}
						}
					}
				},

				deleteView: (mapId, data) => {
					if (this.mapSubscriptions[mapId]) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.pick.includes("views")) {
								this.emit("deleteView", sub.mapSlug, data);
							}
						}
					}
				},

				addHistoryEntry: (mapId, data) => {
					if (this.mapSubscriptions[mapId]) {
						for (const sub of this.mapSubscriptions[mapId]) {
							if (sub.history && (sub.writable === Writable.ADMIN || ["Marker", "Line"].includes(data.type))) {
								this.emit("history", sub.mapSlug, data);
							}
						}
					}
				}
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