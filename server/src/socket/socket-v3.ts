import { generateRandomId } from "../utils/utils.js";
import { iterableToArray, mapAsyncIterable, streamToIterable } from "../utils/streams.js";
import { isInBbox } from "../utils/geo.js";
import { exportLineToRouteGpx, exportLineToTrackGpx } from "../export/gpx.js";
import { isEqual, omit, pull } from "lodash-es";
import Database, { type DatabaseEvents } from "../database/database.js";
import { type BboxWithZoom, SocketVersion, Writable, type SocketServerToClientEmitArgs, type EventName, type MapSlug, type StreamId, type StreamToStreamId, type StreamedResults, type SubscribeToMapPick, type Route, type BboxWithExcept, DEFAULT_PAGING, type ID, type AllMapObjectsItem, type AllMapObjectsPick, subscribeToMapDefaultPick } from "facilmap-types";
import { prepareForBoundingBox } from "../routing/routing.js";
import { type SocketConnection, type DatabaseHandlers, type SocketHandlers } from "./socket-common.js";
import { getI18n, setDomainUnits } from "../i18n.js";
import { ApiV3Backend } from "../api/api-v3.js";
import { getMapDataWithWritable, getMapSlug, getSafeFilename, numberEntries, sleep } from "facilmap-utils";
import { serializeError } from "serialize-error";
import { exportLineToGeoJson } from "../export/geojson.js";

export class SocketConnectionV3 implements SocketConnection<SocketVersion.V3> {

	/**
	 * Emit an event to the client. Async because older socket versions might need to do some as async conversions.
	 * The promise is resolved when the event has been sent. There is no confirmation about it being received.
	 */
	emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V3>) => void | Promise<void>;
	database: Database;
	remoteAddr: string;
	api: ApiV3Backend;

	bbox: BboxWithZoom | undefined = undefined;
	/** AbortControllers for all active map subscriptions. Set synchronously when subscribing. */
	mapSubscriptionAbort: Record<MapSlug, AbortController> = Object.create(null);
	/** Details about most active map subscriptions. Set asynchronously as soon as the map ID is known. */
	mapSubscriptionDetails: Record<ID, Array<{ pick: ReadonlyArray<SubscribeToMapPick>; history: boolean; mapSlug: MapSlug; writable: Writable }>> = {};
	/** AbortControllers for all active route subscriptions. Set synchronously when subscribing. */
	routeSubscriptionAbort: Record<string, AbortController> = Object.create(null);
	/** Details about most active route subscriptions. Set asynchronously as soon as the route is calculated. */
	routeSubscriptionDetails: Record<string, Route & { routeId: string }> = Object.create(null);

	streamAbort: Record<string, AbortController> = {};

	unregisterDatabaseHandlers = (): void => undefined;

	constructor(emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V3>) => void | Promise<void>, database: Database, remoteAddr: string) {
		this.emit = emit;
		this.database = database;
		this.remoteAddr = remoteAddr;
		this.api = new ApiV3Backend(database, remoteAddr);

		this.registerDatabaseHandlers();
	}

	handleDisconnect(): void {
		for (const routeKey of Object.keys(this.routeSubscriptionDetails)) {
			this.database.routes.deleteRoute(this.routeSubscriptionDetails[routeKey].routeId).catch((err) => {
				console.error("Error clearing route", err);
			});
		}

		for (const abort of [...Object.values(this.mapSubscriptionAbort), ...Object.values(this.routeSubscriptionAbort)]) {
			abort.abort();
		}

		this.unregisterDatabaseHandlers();
	};

	emitStream<T>(stream: AsyncIterable<T>): StreamId<T> {
		const streamId = `${generateRandomId(8)}-${Date.now()}` as StreamId<T>;
		void (async () => {
			this.streamAbort[streamId] = new AbortController();
			let chunks: any[] = [];
			let tickPromise: Promise<void> | undefined = undefined;
			let tickScheduled = false;
			try {
				for await (const chunk of stream) {
					this.streamAbort[streamId].signal.throwIfAborted();
					chunks.push(chunk);
					if (!tickScheduled) {
						tickScheduled = true;
						tickPromise = Promise.all([tickPromise, sleep(0)]).then(async () => {
							if (this.streamAbort[streamId].signal.aborted) {
								return;
							}

							const thisChunks = chunks;
							chunks = [];
							tickScheduled = false;

							await this.emit("streamChunks", streamId, thisChunks);
						});
					}
				}

				await tickPromise;
				await this.emit("streamDone", streamId);
			} catch (err: any) {
				this.streamAbort[streamId].abort();
				await this.emit("streamError", streamId, serializeError(err));
			} finally {
				await Promise.resolve(tickPromise).finally(() => {
					delete this.streamAbort[streamId];
				});
			}
		})();
		return streamId;
	}

	emitStreamedResults<T>(results: StreamedResults<T>): StreamToStreamId<StreamedResults<T>> {
		return {
			results: this.emitStream<any>(results.results)
		};
	}

	async emitAllMapObjects(mapSlug: MapSlug, objects: AsyncIterable<AllMapObjectsItem<AllMapObjectsPick>>, signal: AbortSignal): Promise<void> {
		for await (const obj of objects) {
			if (signal?.aborted) {
				return;
			}

			if (obj.type === "mapData") {
				await this.emit("mapData", mapSlug, obj.data);
			} else if (obj.type === "markers") {
				for await (const marker of obj.data) {
					await this.emit("marker", mapSlug, marker);
				}
			} else if (obj.type === "lines") {
				for await (const line of obj.data) {
					await this.emit("line", mapSlug, line);
				}
			} else if (obj.type === "linePoints") {
				for await (const linePoints of obj.data) {
					await this.emit("linePoints", mapSlug, { ...linePoints, reset: true });
				}
			} else if (obj.type === "types") {
				for await (const type of obj.data) {
					await this.emit("type", mapSlug, type);
				}
			} else if (obj.type === "views") {
				for await (const view of obj.data) {
					await this.emit("view", mapSlug, view);
				}
			}
		}
	}

	findMapSubscriptionData(mapSlug: MapSlug, remove: boolean): (typeof this.mapSubscriptionDetails[ID][number] & { mapId: ID }) | undefined {
		for (const [mapId, subs] of numberEntries(this.mapSubscriptionDetails)) {
			const sub = subs.find((s) => s.mapSlug === mapSlug);
			if (sub) {
				if (remove) {
					pull(subs, sub);
					if (subs.length === 0) {
						delete this.mapSubscriptionDetails[mapId];
					}
				}
				return { ...sub, mapId };
			}
		}
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
				return this.emitStream(mapAsyncIterable(results, (obj) => {
					if (obj.type === "mapData") {
						return obj;
					} else {
						return { ...obj, data: this.emitStream<any>(obj.data) };
					}
				}));
			},

			updateMap: async (mapSlug, data) => {
				return await this.api.updateMap(mapSlug, data);
			},

			deleteMap: async (mapSlug) => {
				await this.api.deleteMap(mapSlug);
			},

			getAllMapObjects: async (mapSlug, options) => {
				const results = await this.api.getAllMapObjects(mapSlug, options);
				return this.emitStream(mapAsyncIterable(results, (obj) => {
					if (obj.type === "mapData") {
						return obj;
					} else {
						return { ...obj, data: this.emitStream<any>(obj.data) };
					}
				}));
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
					for (const route of Object.values(this.routeSubscriptionDetails)) {
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
					for (const route of Object.values(this.routeSubscriptionDetails)) {
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

			getLineTemplate: async (mapSlug, options) => {
				return await this.api.getLineTemplate(mapSlug, options);
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

			subscribeToMap: async (mapSlug, { pick = subscribeToMapDefaultPick, history = false } = {}) => {
				const abort = this.mapSubscriptionAbort[mapSlug] = this.mapSubscriptionAbort[mapSlug] ?? new AbortController();

				let existingSub = this.findMapSubscriptionData(mapSlug, false);
				if (!existingSub) {
					let mapData;
					try {
						mapData = await this.api.getMap(mapSlug);
					} catch (err: any) {
						if (err.status === 404 && !abort.signal.aborted && !this.findMapSubscriptionData(mapSlug, false)) {
							// Map not found, clear subscription so that we can create it using createMapAndSubscribe
							delete this.mapSubscriptionAbort[mapSlug];
						}
						throw err;
					}

					if (abort.signal.aborted) { // Unsubscribed while fetching map data
						return;
					}
					existingSub = this.findMapSubscriptionData(mapSlug, false); // Another request might have created a subscription in the meantime
					if (!existingSub) {
						if (!this.mapSubscriptionDetails[mapData.id]) {
							this.mapSubscriptionDetails[mapData.id] = [];
						}
						this.mapSubscriptionDetails[mapData.id].push({ pick, history, mapSlug, writable: mapData.writable });
						this.registerDatabaseHandlers();
					}
				}

				const pickBefore = existingSub?.pick;
				if (existingSub) {
					Object.assign(existingSub, { pick, history });
				}

				const newPick = pickBefore ? pick.filter((p) => !pickBefore.includes(p)) : pick;
				const results = await this.api.getAllMapObjects(mapSlug, {
					pick: this.bbox ? newPick : newPick.filter((p) => !["markers", "linePoints"].includes(p)),
					bbox: this.bbox
				});

				await this.emitAllMapObjects(mapSlug, results, abort.signal);
			},

			createMapAndSubscribe: async (data, { pick = subscribeToMapDefaultPick, history = false } = {}) => {
				if (this.mapSubscriptionAbort[data.adminId]) {
					throw new Error(getI18n().t("socket.map-already-subscribed-error", { mapSlug: data.adminId }));
				}
				const abort = new AbortController();
				this.mapSubscriptionAbort[data.adminId] = abort;

				const results = await this.api.createMap(data, {
					pick: this.bbox ? pick : pick.filter((p) => !["markers", "linePoints"].includes(p)),
					bbox: this.bbox
				});

				await this.emitAllMapObjects(data.adminId, mapAsyncIterable(results, (obj) => {
					if (!abort.signal.aborted && obj.type === "mapData") {
						if (!this.mapSubscriptionDetails[obj.data.id]) {
							this.mapSubscriptionDetails[obj.data.id] = [];
						}
						this.mapSubscriptionDetails[obj.data.id].push({ pick, history, mapSlug: data.adminId, writable: obj.data.writable });
						this.registerDatabaseHandlers();
					}
					return obj;
				}), abort.signal);
			},

			unsubscribeFromMap: async (mapSlug) => {
				if (!this.mapSubscriptionAbort[mapSlug]) {
					throw new Error(getI18n().t("socket.map-not-subscribed-error", { mapSlug }));
				}

				this.mapSubscriptionAbort[mapSlug].abort();
				delete this.mapSubscriptionAbort[mapSlug];
				this.findMapSubscriptionData(mapSlug, true);
				this.registerDatabaseHandlers();
			},

			subscribeToRoute: async (routeKey, params) => {
				const abort = this.routeSubscriptionAbort[routeKey] = this.routeSubscriptionAbort[routeKey] ?? new AbortController();

				const existingRoute = this.routeSubscriptionDetails[routeKey];

				let routeInfo;
				if ("lineId" in params) {
					const mapData = await this.api.getMap(params.mapSlug);
					routeInfo = await this.database.routes.lineToRoute(existingRoute?.routeId, mapData.id, params.lineId);
				} else if (existingRoute) {
					routeInfo = await this.database.routes.updateRoute(existingRoute.routeId, [...params.routePoints], params.mode);
				} else {
					routeInfo = await this.database.routes.createRoute([...params.routePoints], params.mode);
				}

				if(!routeInfo || abort.signal.aborted) {
					// A newer submitted route has returned in the meantime
					console.log("Ignoring outdated route");
					return;
				}

				this.routeSubscriptionDetails[routeKey] = omit(routeInfo, ["trackPoints"]);

				await this.emit("route", routeKey, omit(routeInfo, ["trackPoints", "routeId"]));

				if(this.bbox) {
					await this.emit("routePoints", routeKey, {
						trackPoints: prepareForBoundingBox(routeInfo.trackPoints, this.bbox, true),
						reset: true
					});
				}
			},

			unsubscribeFromRoute: async (routeKey) => {
				if (!this.routeSubscriptionAbort[routeKey]) {
					throw new Error(getI18n().t("socket.route-not-subscribed-error", { routeKey }));
				}

				this.routeSubscriptionAbort[routeKey].abort();
				delete this.routeSubscriptionAbort[routeKey];

				if (this.routeSubscriptionDetails[routeKey]) {
					await this.database.routes.deleteRoute(this.routeSubscriptionDetails[routeKey].routeId);
					delete this.routeSubscriptionDetails[routeKey];
				}
			},

			exportRoute: async (routeId, options) => {
				const route = this.routeSubscriptionDetails[routeId];
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
							data: this.emitStream(streamToIterable(exportLineToTrackGpx(routeInfo, undefined, this.database.routes.getAllRoutePoints(route.routeId)).pipeThrough(new TextEncoderStream())))
						};
					case "gpx-rte":
						return {
							type: "application/gpx+xml",
							filename: `${filename}.gpx`,
							data: this.emitStream(streamToIterable(exportLineToRouteGpx(routeInfo, undefined).pipeThrough(new TextEncoderStream())))
						};
					case "geojson":
						return {
							type: "application/geo+json",
							filename: `${filename}.geojson`,
							data: this.emitStream(streamToIterable(exportLineToGeoJson(routeInfo, undefined, this.database.routes.getAllRoutePoints(route.routeId)).pipeThrough(new TextEncoderStream())))
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

				for (const subs of Object.values(this.mapSubscriptionDetails)) {
					for (const sub of subs) {
						const markerObjs = await this.api.getAllMapObjects(sub.mapSlug, { pick: ["markers"], bbox: markerBboxWithExcept });
						for await (const obj of markerObjs) {
							for await (const marker of obj.data) {
								await this.emit("marker", sub.mapSlug, marker);
							}
						}

						const lineObjs = await this.api.getAllMapObjects(sub.mapSlug, { pick: ["linePoints"], bbox: lineBboxWithExcept });
						for await (const obj of lineObjs) {
							for await (const linePoints of obj.data) {
								await this.emit("linePoints", sub.mapSlug, { ...linePoints, reset: false });
							}
						}
					}
				}

				for (const [routeKey, sub] of Object.entries(this.routeSubscriptionDetails)) {
					const trackPoints = await this.database.routes.getRoutePoints(sub.routeId, lineBboxWithExcept, !lineBboxWithExcept.except);
					await this.emit("routePoints", routeKey, { trackPoints, reset: false });
				}
			},

			abortStream: async (streamId) => {
				if (this.streamAbort[streamId]) {
					this.streamAbort[streamId].abort();
				}
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
			...(Object.keys(this.mapSubscriptionDetails).length > 0 ? {
				mapData: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("mapData")) {
								void this.emit("mapData", sub.mapSlug, getMapDataWithWritable(data, sub.writable));
							}
						}

						const slugMap = Object.fromEntries(this.mapSubscriptionDetails[mapId].flatMap((sub) => {
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
							void this.emit("mapSlugRename", slugMap);
						}

						if (data.id !== mapId) {
							this.mapSubscriptionDetails[data.id] = [
								...this.mapSubscriptionDetails[data.id] ?? [],
								...this.mapSubscriptionDetails[mapId]
							];
							delete this.mapSubscriptionDetails[mapId];
						}
					}
				},

				deleteMap: (mapId) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							void this.emit("deleteMap", sub.mapSlug);
						}
					}
				},

				marker: (mapId, marker, oldMarker) => {
					if (this.mapSubscriptionDetails[mapId] && this.bbox && (isInBbox(marker, this.bbox) || (oldMarker && isInBbox(oldMarker, this.bbox)))) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("markers")) {
								void this.emit("marker", sub.mapSlug, marker);
							}
						}
					}
				},

				deleteMarker: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("markers")) {
								void this.emit("deleteMarker", sub.mapSlug, data);
							}
						}
					}
				},

				line: (mapId, line) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("lines")) {
								void this.emit("line", sub.mapSlug, line);
							}
						}
					}
				},

				linePoints: (mapId, lineId, trackPoints) => {
					if (this.mapSubscriptionDetails[mapId] && this.bbox) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("linePoints")) {
								void this.emit("linePoints", sub.mapSlug, {
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
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("lines")) {
								void this.emit("deleteLine", sub.mapSlug, data);
							}
						}
					}
				},

				type: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("types")) {
								void this.emit("type", sub.mapSlug, data);
							}
						}
					}
				},

				deleteType: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("types")) {
								void this.emit("deleteType", sub.mapSlug, data);
							}
						}
					}
				},

				view: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("views")) {
								void this.emit("view", sub.mapSlug, data);
							}
						}
					}
				},

				deleteView: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("views")) {
								void this.emit("deleteView", sub.mapSlug, data);
							}
						}
					}
				},

				historyEntry: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.history && (sub.writable === Writable.ADMIN || ["Marker", "Line"].includes(data.type))) {
								void this.emit("history", sub.mapSlug, data);
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