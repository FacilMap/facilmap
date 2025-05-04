import { generateRandomId } from "../utils/utils.js";
import { mapAsyncIterable, streamToIterable } from "../utils/streams.js";
import { isInBbox } from "../utils/geo.js";
import { exportLineToRouteGpx, exportLineToTrackGpx } from "../export/gpx.js";
import { isEqual, omit, pull } from "lodash-es";
import Database, { type DatabaseEvents } from "../database/database.js";
import { type BboxWithZoom, SocketVersion, type SocketServerToClientEmitArgs, type EventName, type MapSlug, type StreamId, type StreamToStreamId, type StreamedResults, type SubscribeToMapPick, type Route, type BboxWithExcept, DEFAULT_PAGING, type ID, type AllMapObjectsItem, type AllMapObjectsPick, subscribeToMapDefaultPick, markStripped, type Type, type Line, type Marker, type Stripped, type AnyMapSlug, getMainAdminLink, type ExportResult, type ReplaceProperties } from "facilmap-types";
import { prepareForBoundingBox } from "../routing/routing.js";
import { type SocketConnection, type DatabaseHandlers, type SocketHandlers } from "./socket-common.js";
import { getI18n, setDomainUnits } from "../i18n.js";
import { ApiV3Backend } from "../api/api-v3.js";
import { canReadObject, getSafeFilename, numberEntries, sleep } from "facilmap-utils";
import { serializeError } from "serialize-error";
import { exportLineToGeoJson } from "../export/geojson.js";
import { isOwn, resolveMapLink, stripHistoryEntry, stripLine, stripMapData, stripMarker, stripType, stripView, type RawActiveMapLink } from "../utils/permissions.js";
import { getIdentityHash } from "../utils/crypt.js";

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
	mapSubscriptionDetails: Record<ID, Array<{
		pick: ReadonlyArray<SubscribeToMapPick>;
		history: boolean;
		mapSlug: MapSlug;
		mapLink: RawActiveMapLink;
	}>> = {};
	/** AbortControllers for all active route subscriptions. Set synchronously when subscribing. */
	routeSubscriptionAbort: Record<string, AbortController> = Object.create(null);
	/** Details about most active route subscriptions. Set asynchronously as soon as the route is calculated. */
	routeSubscriptionDetails: Record<string, Route & { routeId: string }> = Object.create(null);

	streamAbort: Record<string, AbortController> = {};

	unregisterDatabaseHandlers = (): void => undefined;

	constructor(
		emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V3>) => void | Promise<void>,
		database: Database,
		remoteAddr: string
	) {
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
						tickPromise = Promise.all([tickPromise, sleep(20)]).then(async () => {
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

	emitExportResult(result: ExportResult): ReplaceProperties<ExportResult, { data: StreamId<Uint8Array> }> {
		return {
			...result,
			data: this.emitStream(streamToIterable(result.data))
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

	resolveMapSlug(anyMapSlug: AnyMapSlug): AnyMapSlug | RawActiveMapLink {
		const { mapSlug, password, identity } = typeof anyMapSlug === "string" ? { mapSlug: anyMapSlug } : anyMapSlug;
		if (password == null && identity == null) {
			const sub = this.findMapSubscriptionData(mapSlug, false);
			if (sub) {
				return sub.mapLink;
			}
		}
		return anyMapSlug;
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
				return await this.api.getMap(this.resolveMapSlug(mapSlug));
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
				const result = await this.api.updateMap(this.resolveMapSlug(mapSlug), data);
				const sub = this.findMapSubscriptionData(typeof mapSlug === "string" ? mapSlug : mapSlug.mapSlug, false);
				if (sub) {
					// Set sub.mapSlug to the new mapSlug (but not sub.mapLink.slug)
					// This will make the mapData database handler below recognize the map rename.
					sub.mapSlug = result.activeLink.slug;
				}
				return result;
			},

			deleteMap: async (mapSlug) => {
				await this.api.deleteMap(this.resolveMapSlug(mapSlug));
			},

			getAllMapObjects: async (mapSlug, options) => {
				const results = await this.api.getAllMapObjects(this.resolveMapSlug(mapSlug), options);
				return this.emitStream(mapAsyncIterable(results, (obj) => {
					if (obj.type === "mapData") {
						return obj;
					} else {
						return { ...obj, data: this.emitStream<any>(obj.data) };
					}
				}));
			},

			findOnMap: async (mapSlug, query) => {
				return await this.api.findOnMap(this.resolveMapSlug(mapSlug), query);
			},

			getMapToken: async (mapSlug, permissions) => {
				return await this.api.getMapToken(this.resolveMapSlug(mapSlug), permissions);
			},

			exportMapAsGpx: async (mapSlug, options) => {
				return this.emitExportResult(await this.api.exportMapAsGpx(mapSlug, options));
			},

			exportMapAsGpxZip: async (mapSlug, options) => {
				return this.emitExportResult(await this.api.exportMapAsGpxZip(mapSlug, options));
			},

			exportMapAsGeoJson: async (mapSlug, options) => {
				return this.emitExportResult(await this.api.exportMapAsGeoJson(mapSlug, options));
			},

			exportMapAsTable: async (mapSlug, options) => {
				return this.emitExportResult(await this.api.exportMapAsTable(mapSlug, options));
			},

			exportMapAsCsv: async (mapSlug, options) => {
				return this.emitExportResult(await this.api.exportMapAsCsv(mapSlug, options));
			},

			getHistory: async (mapSlug, paging = DEFAULT_PAGING) => {
				return await this.api.getHistory(this.resolveMapSlug(mapSlug), paging);
			},

			revertHistoryEntry: async (mapSlug, historyEntryId) => {
				await this.api.revertHistoryEntry(this.resolveMapSlug(mapSlug), historyEntryId);
			},

			getMapMarkers: async (mapSlug, options = {}) => {
				return this.emitStreamedResults(await this.api.getMapMarkers(this.resolveMapSlug(mapSlug), options));
			},

			getMarker: async (mapSlug, markerId) => {
				return await this.api.getMarker(this.resolveMapSlug(mapSlug), markerId);
			},

			createMarker: async (mapSlug, data) => {
				return await this.api.createMarker(this.resolveMapSlug(mapSlug), data);
			},

			updateMarker: async (mapSlug, markerId, data) => {
				return await this.api.updateMarker(this.resolveMapSlug(mapSlug), markerId, data);
			},

			deleteMarker: async (mapSlug, markerId) => {
				await this.api.deleteMarker(this.resolveMapSlug(mapSlug), markerId);
			},

			getMapLines: async (mapSlug, options) => {
				return this.emitStreamedResults(await this.api.getMapLines(this.resolveMapSlug(mapSlug), options));
			},

			getLine: async (mapSlug, lineId) => {
				return await this.api.getLine(this.resolveMapSlug(mapSlug), lineId);
			},

			getLinePoints: async (mapSlug, lineId, options) => {
				return this.emitStreamedResults(await this.api.getLinePoints(this.resolveMapSlug(mapSlug), lineId, options));
			},

			createLine: async (mapSlug, data) => {
				let trackPointsFromRoute;
				if (data.mode != "track") {
					for (const route of Object.values(this.routeSubscriptionDetails)) {
						if(isEqual(route.routePoints, data.routePoints) && data.mode == route.mode) {
							trackPointsFromRoute = { ...route, trackPoints: this.database.routes.getAllRoutePoints(route.routeId) };
							break;
						}
					}
				}

				return await this.api.createLine(this.resolveMapSlug(mapSlug), data, { trackPointsFromRoute });
			},

			updateLine: async (mapSlug, lineId, data) => {
				let fromRoute;
				if (data.mode != "track") {
					for (const route of Object.values(this.routeSubscriptionDetails)) {
						if(isEqual(route.routePoints, data.routePoints) && data.mode == route.mode) {
							fromRoute = { ...route, trackPoints: this.database.routes.getAllRoutePoints(route.routeId) };
							break;
						}
					}
				}

				return await this.api.updateLine(this.resolveMapSlug(mapSlug), lineId, data, fromRoute);
			},

			deleteLine: async (mapSlug, lineId) => {
				await this.api.deleteLine(this.resolveMapSlug(mapSlug), lineId);
			},

			exportLineAsGpx: async (mapSlug, lineId, options) => {
				return this.emitExportResult(await this.api.exportLineAsGpx(this.resolveMapSlug(mapSlug), lineId, options));
			},

			exportLineAsGeoJson: async (mapSlug, lineId) => {
				return this.emitExportResult(await this.api.exportLineAsGeoJson(this.resolveMapSlug(mapSlug), lineId));
			},

			getLineTemplate: async (mapSlug, options) => {
				return await this.api.getLineTemplate(this.resolveMapSlug(mapSlug), options);
			},

			getMapTypes: async (mapSlug) => {
				return this.emitStreamedResults(await this.api.getMapTypes(this.resolveMapSlug(mapSlug)));
			},

			getType: async (mapSlug, id) => {
				return await this.api.getType(this.resolveMapSlug(mapSlug), id);
			},

			createType: async (mapSlug, data) => {
				return await this.api.createType(this.resolveMapSlug(mapSlug), data);
			},

			updateType: async (mapSlug, typeId, data) => {
				return await this.api.updateType(this.resolveMapSlug(mapSlug), typeId, data);
			},

			deleteType: async (mapSlug, typeId) => {
				await this.api.deleteType(this.resolveMapSlug(mapSlug), typeId);
			},

			getMapViews: async (mapSlug) => {
				return this.emitStreamedResults(await this.api.getMapViews(this.resolveMapSlug(mapSlug)));
			},

			getView: async (mapSlug, viewId) => {
				return await this.api.getView(this.resolveMapSlug(mapSlug), viewId);
			},

			createView: async (mapSlug, data) => {
				return await this.api.createView(this.resolveMapSlug(mapSlug), data);
			},

			updateView: async (mapSlug, viewId, data) => {
				return await this.api.updateView(this.resolveMapSlug(mapSlug), viewId, data);
			},

			deleteView: async (mapSlug, viewId) => {
				await this.api.deleteView(this.resolveMapSlug(mapSlug), viewId);
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

			subscribeToMap: async (anyMapSlug, { pick = subscribeToMapDefaultPick, history = false, identity } = {}) => {
				const { mapSlug } = typeof anyMapSlug === "string" ? { mapSlug: anyMapSlug } : anyMapSlug;
				const abort = this.mapSubscriptionAbort[mapSlug] = this.mapSubscriptionAbort[mapSlug] ?? new AbortController();

				let sub = this.findMapSubscriptionData(mapSlug, false);
				let resolved;
				if (!sub) {
					try {
						resolved = await this.api.resolveMapSlug({
							...typeof anyMapSlug === "string" ? { mapSlug: anyMapSlug } : anyMapSlug,
							...identity != null ? { identity } : {}
						});
					} catch (err: any) {
						if ([401, 404].includes(err.status) && !abort.signal.aborted && !this.findMapSubscriptionData(mapSlug, false)) {
							// Map not found, clear subscription so that we can create it using createMapAndSubscribe
							// No/wrong password, clear subscription so that we can reauthenticate
							delete this.mapSubscriptionAbort[mapSlug];
						}
						throw err;
					}

					if (abort.signal.aborted) { // Unsubscribed while fetching map data
						return;
					}
					sub = this.findMapSubscriptionData(mapSlug, false); // Another request might have created a subscription in the meantime
				}

				const identityBefore = sub ? sub.mapLink.identity : undefined;
				const pickBefore = sub?.pick;
				if (sub) {
					Object.assign(sub, { pick, history });
					if (typeof identity !== "undefined") {
						if (identity == null) {
							sub.mapLink.identity = undefined;
						} else {
							const { rawMapData } = await this.api.resolveMapSlug(sub.mapLink);
							sub.mapLink.identity = getIdentityHash(identity, rawMapData.salt);
						}
					}
				} else {
					if (!this.mapSubscriptionDetails[resolved!.mapData.id]) {
						this.mapSubscriptionDetails[resolved!.mapData.id] = [];
					}
					const newSub = { pick, history, mapSlug, mapLink: resolved!.activeLink };
					sub = { ...newSub, mapId: resolved!.mapData.id };
					this.mapSubscriptionDetails[resolved!.mapData.id].push(newSub);
					this.registerDatabaseHandlers();
				}

				const identityChanged = (identityBefore == null) !== (sub.mapLink.identity == null) || (identityBefore != null && sub.mapLink.identity != null && !identityBefore.equals(sub.mapLink.identity));

				const newPick = pickBefore ? pick.filter((p) => !pickBefore.includes(p) || (identityChanged && ["markers", "lines"].includes(p))) : pick;
				const results = await this.api.getAllMapObjects(sub.mapLink, {
					pick: this.bbox ? newPick : newPick.filter((p) => !["markers", "linePoints"].includes(p)),
					bbox: this.bbox
				});

				await this.emitAllMapObjects(mapSlug, results, abort.signal);
			},

			createMapAndSubscribe: async (data, { pick = subscribeToMapDefaultPick, history = false, identity } = {}) => {
				const mainLink = getMainAdminLink(data.links);
				if (this.mapSubscriptionAbort[mainLink.slug]) {
					throw new Error(getI18n().t("socket.map-already-subscribed-error", { mapSlug: mainLink.slug }));
				}
				const abort = new AbortController();
				this.mapSubscriptionAbort[mainLink.slug] = abort;

				const { activeLink, results, rawMapData } = await this.api._createMap(data, {
					pick: this.bbox ? pick : pick.filter((p) => !["markers", "linePoints"].includes(p)),
					bbox: this.bbox
				});

				if (abort.signal.aborted) {
					return;
				}

				if (!this.mapSubscriptionDetails[activeLink.mapId]) {
					this.mapSubscriptionDetails[activeLink.mapId] = [];
				}
				this.mapSubscriptionDetails[activeLink.mapId].push({
					pick,
					history,
					mapSlug: activeLink.slug,
					mapLink: {
						...activeLink,
						identity: identity != null ? getIdentityHash(identity, rawMapData.salt) : undefined
					}
				});
				this.registerDatabaseHandlers();

				await this.emitAllMapObjects(activeLink.slug, results, abort.signal);
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

				try {
					let routeInfo;
					if ("lineId" in params) {
						const mapData = await this.api.getMap(params.mapSlug);
						routeInfo = await this.database.routes.lineToRoute(existingRoute?.routeId, mapData.id, params.lineId);
					} else if (existingRoute) {
						routeInfo = await this.database.routes.updateRoute(existingRoute.routeId, [...params.routePoints], params.mode);
					} else {
						routeInfo = await this.database.routes.createRoute([...params.routePoints], params.mode);
					}

					abort.signal.throwIfAborted();

					this.routeSubscriptionDetails[routeKey] = omit(routeInfo, ["trackPoints"]);

					await this.emit("route", routeKey, omit(routeInfo, ["trackPoints", "routeId"]));

					if(this.bbox) {
						await this.emit("routePoints", routeKey, {
							trackPoints: prepareForBoundingBox(routeInfo.trackPoints, this.bbox, true),
							reset: true
						});
					}
				} catch (err: any) {
					if (err.name === "AbortError") {
						// A newer submitted route has returned in the meantime (AbortError thrown by database)
						// or the route has been unsubscribed in the meantime (AbortError thrown by socket)
						console.log("Ignoring outdated route");
					} else {
						throw err;
					}
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

			exportRouteAsGpx: async (routeId, options) => {
				const route = this.routeSubscriptionDetails[routeId];
				if (!route) {
					throw new Error(getI18n().t("socket.route-not-available-error"));
				}

				const routeInfo = markStripped({ ...route, name: getI18n().t("socket.route-name"), data: {} });
				const data = (
					options?.rte ? exportLineToRouteGpx(routeInfo, undefined) :
					exportLineToTrackGpx(routeInfo, undefined, this.database.routes.getAllRoutePoints(route.routeId))
				);

				return {
					type: "application/gpx+xml",
					filename: `${getSafeFilename(routeInfo.name)}.gpx`,
					data: this.emitStream(streamToIterable(data.pipeThrough(new TextEncoderStream())))
				};
			},

			exportRouteAsGeoJson: async (routeId) => {
				const route = this.routeSubscriptionDetails[routeId];
				if (!route) {
					throw new Error(getI18n().t("socket.route-not-available-error"));
				}

				const routeInfo = markStripped({ ...route, name: getI18n().t("socket.route-name"), data: {} });

				return {
					type: "application/geo+json",
					filename: `${getSafeFilename(routeInfo.name)}.geojson`,
					data: this.emitStream(streamToIterable(exportLineToGeoJson(routeInfo, undefined, this.database.routes.getAllRoutePoints(route.routeId)).pipeThrough(new TextEncoderStream())))
				};
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
				mapData: async (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						const unsubscribe: MapSlug[] = [];
						const reemit: Array<[RawActiveMapLink, RawActiveMapLink, AbortController]> = [];
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							const oldLink = sub.mapLink;
							try {
								// If this socket connection caused the change, sub.mapSlug was updated in
								// updateMap() to the new map slug, so we can find it here. If another socket
								// connection caused the change, we unsubscribe here if the old map slug does
								// not exist anymore.
								sub.mapLink = resolveMapLink(sub.mapSlug, sub.mapLink.password, sub.mapLink.identity, data);
							} catch (err: any) {
								void this.emit("cancelMapSubscription", sub.mapSlug, err);
								unsubscribe.push(sub.mapSlug);
								continue;
							}

							if (!isEqual(oldLink.permissions, sub.mapLink.permissions)) {
								reemit.push([oldLink, sub.mapLink, this.mapSubscriptionAbort[sub.mapSlug]]);
							}

							if (sub.pick.includes("mapData")) {
								// Emit with the old slug so that clients can react to the change
								void this.emit("mapData", oldLink.slug, stripMapData(sub.mapLink, data));
							}
						}

						// Unsubscribe now so that we don't change the subscription array while iterating over it
						if (unsubscribe.length > 0) {
							for (const mapSlug of unsubscribe) {
								this.mapSubscriptionAbort[mapSlug].abort();
								delete this.mapSubscriptionAbort[mapSlug];
								this.findMapSubscriptionData(mapSlug, true);
							}
							this.registerDatabaseHandlers();
						}

						for (const [oldLink, newLink, abort] of reemit) {
							const oldResults = await this.api.getAllMapObjects(oldLink, {
								pick: ["types", "lines", ...this.bbox ? ["markers" as const] : []],
								bbox: this.bbox
							});
							const oldIds = { types: new Set<ID>(), lines: new Set<ID>(), markers: new Set<ID>() };
							for await (const oldResult of oldResults) {
								for await (const result of oldResult.data) {
									oldIds[oldResult.type].add(result.id);
								}
							}

							if (abort.signal.aborted) {
								continue;
							}

							const newResults = await this.api.getAllMapObjects(newLink, {
								pick: ["types", "lines", ...this.bbox ? ["markers" as const] : []],
								bbox: this.bbox
							});

							await this.emitAllMapObjects(newLink.slug, mapAsyncIterable(newResults, (newResult) => ({
								type: newResult.type,
								data: mapAsyncIterable(newResult.data, (result: Stripped<Marker | Line | Type>) => {
									oldIds[newResult.type].delete(result.id);
									return result;
								})
							} as typeof newResult)), abort.signal);

							if (abort.signal.aborted) {
								continue;
							}

							for (const id of oldIds.markers) {
								void this.emit("deleteMarker", newLink.slug, markStripped({ id }));
							}
							for (const id of oldIds.lines) {
								void this.emit("deleteLine", newLink.slug, markStripped({ id }));
							}
							for (const id of oldIds.types) {
								void this.emit("deleteType", newLink.slug, markStripped({ id }));
							}
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
								const stripped = stripMarker(sub.mapLink, marker);
								if (stripped) {
									void this.emit("marker", sub.mapSlug, stripped);
								}
							}
						}
					}
				},

				deleteMarker: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("markers")) {
								if (canReadObject(sub.mapLink.permissions, data.typeId, isOwn(sub.mapLink, data))) {
									void this.emit("deleteMarker", sub.mapSlug, markStripped({
										id: data.id
									}));
								}
							}
						}
					}
				},

				line: (mapId, line) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("lines")) {
								const stripped = stripLine(sub.mapLink, line);
								if (stripped) {
									void this.emit("line", sub.mapSlug, stripped);
								}
							}
						}
					}
				},

				linePoints: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId] && this.bbox) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("linePoints")) {
								if (canReadObject(sub.mapLink.permissions, data.line.typeId, isOwn(sub.mapLink, data.line))) {
									void this.emit("linePoints", sub.mapSlug, markStripped({
										lineId: data.line.id,
										// Emit track points even if none are in the bbox so that client resets cached track points
										trackPoints: prepareForBoundingBox(data.trackPoints, this.bbox),
										reset: data.reset
									}));
								}
							}
						}
					}
				},

				deleteLine: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("lines")) {
								if (canReadObject(sub.mapLink.permissions, data.typeId, isOwn(sub.mapLink, data))) {
									void this.emit("deleteLine", sub.mapSlug, markStripped({
										id: data.id
									}));
								}
							}
						}
					}
				},

				type: (mapId, data) => {
					if (this.mapSubscriptionDetails[mapId]) {
						for (const sub of this.mapSubscriptionDetails[mapId]) {
							if (sub.pick.includes("types")) {
								const stripped = stripType(sub.mapLink, data);
								if (stripped) {
									void this.emit("type", sub.mapSlug, stripped);
								}
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
								const stripped = stripView(sub.mapLink, data);
								if (stripped) {
									void this.emit("view", sub.mapSlug, stripped);
								}
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
							if (sub.history) {
								const stripped = stripHistoryEntry(sub.mapLink, data);
								if (stripped) {
									void this.emit("history", sub.mapSlug, stripped);
								}
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