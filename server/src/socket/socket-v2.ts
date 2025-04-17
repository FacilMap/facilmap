import { SocketVersion, type SocketEvents, type MultipleEvents, type FindOnMapResult, type SocketServerToClientEmitArgs, legacyV2MarkerToCurrent, currentMarkerToLegacyV2, currentTypeToLegacyV2, legacyV2TypeToCurrent, currentLineToLegacyV2, currentViewToLegacyV2, currentHistoryEntryToLegacyV2, type StreamId, type MapSlug, type BboxWithZoom, Writable, type Route, type AllMapObjectsPick, type AllMapObjectsItem, type StreamToStreamId, type SetBboxItem, currentMapDataToLegacyV2, legacyV2MapDataToCurrent, legacyV2RouteRequestToCurrent, type ID, type Type } from "facilmap-types";
import { type SocketConnection, type SocketHandlers } from "./socket-common";
import { SocketConnectionV3 } from "./socket-v3";
import type Database from "../database/database";
import { pick } from "lodash-es";
import { streamToIterable, streamToString } from "../utils/streams";
import { getI18n } from "../i18n";
import { getLineTemplate, getMapSlug, parseUrlQuery } from "facilmap-utils";
import { deserializeError } from "serialize-error";

function prepareMapResultOutput(result: FindOnMapResult, type: Type, readId: MapSlug) {
	if (result.kind === "marker") {
		return currentMarkerToLegacyV2(result, type, readId);
	} else {
		return result;
	}
}

export function mapMultipleEvents<VIn extends SocketVersion, VOut extends SocketVersion>(events: MultipleEvents<SocketEvents<VIn>>, mapper: (...args: SocketServerToClientEmitArgs<VIn>) => Array<SocketServerToClientEmitArgs<VOut>>): MultipleEvents<SocketEvents<VOut>> {
	const result: any = {};
	for (const [oldEventName, oldEvents] of Object.entries(events)) {
		for (const oldEvent of oldEvents) {
			for (const [newEventName, ...newEvent] of (mapper as any)(oldEventName, oldEvent)) {
				if (!result[newEventName]) {
					result[newEventName] = [];
				}
				result[newEventName].push(newEvent[0]);
			}
		}
	}
	return result;
}

export class SocketConnectionV2 implements SocketConnection<SocketVersion.V2> {
	socketV3: SocketConnectionV3;
	streams: Record<StreamId<any>, WritableStreamDefaultWriter<any[]>> = {};

	mapSlug: MapSlug | undefined = undefined;
	readId: MapSlug | undefined = undefined;
	bbox: BboxWithZoom | undefined = undefined;
	/** Cached (v3) types of the subscribed map, needed for marker/line data conversion. */
	types: Record<ID, Type> = {};
	writable: Writable | undefined = undefined;
	routes: Record<string, Route> = { };
	listeningToHistory = false;
	pauseHistoryListener = 0;

	eventInterceptors: Array<(...args: SocketServerToClientEmitArgs<SocketVersion.V2>) => boolean | void> = [];

	routeAborts: Record<string, AbortController> = {};

	constructor(emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V2>) => void | Promise<void>, database: Database, remoteAddr: string) {
		this.socketV3 = new SocketConnectionV3(async (...args) => {
			if (args[0] === "type") {
				this.types[args[2].id] = args[2];
			} else if (args[0] === "deleteType") {
				delete this.types[args[2].id];
			}

			if (args[0] === "streamChunks") {
				for (const chunk of args[2]) {
					this.streams[args[1]].write(chunk).catch(() => undefined);
				}
			} else if (args[0] === "streamDone") {
				this.streams[args[1]].close().catch(() => undefined);
			} else if (args[0] === "streamError") {
				this.streams[args[1]].abort(deserializeError(args[1])).catch(() => undefined);
			} else if (args[0] === "route") {
				this.routes[args[1]] = args[2];
			} else {
				for (const ev of await this.prepareEvent(...args)) {
					if (!this.eventInterceptors.some((interceptor) => interceptor(...ev))) {
						await emit(...ev);
					}
				}
			}
		}, database, remoteAddr);
	}

	async prepareEvent(...args: SocketServerToClientEmitArgs<SocketVersion.V3>): Promise<Array<SocketServerToClientEmitArgs<SocketVersion.V2>>> {
		if (args[0] === "marker") {
			return [[args[0], currentMarkerToLegacyV2(args[2], this.types[args[2].typeId], this.readId!)]];
		} else if (args[0] === "line") {
			return [[args[0], currentLineToLegacyV2(args[2], this.types[args[2].typeId], this.readId!)]];
		} else if (args[0] === "type") {
			return [[args[0], currentTypeToLegacyV2(args[2], this.readId!)]];
		} else if (args[0] === "view") {
			return [[args[0], currentViewToLegacyV2(args[2], this.readId!)]];
		} else if (args[0] === "history") {
			if (this.pauseHistoryListener) {
				return [];
			}

			return [[args[0], currentHistoryEntryToLegacyV2(args[2], this.readId!, (typeId) => this.types[typeId])]];
		} else if (args[0] === "mapData") {
			this.mapSlug = getMapSlug(args[2]);
			this.readId = args[2].readId;
			return [["padData", currentMapDataToLegacyV2(args[2])]];
		} else if (args[0] === "deleteMap") {
			return [["deletePad"]];
		} else if (args[0] === "linePoints") {
			return [["linePoints", {
				id: args[2].lineId,
				trackPoints: args[2].trackPoints,
				reset: true
			}]];
		} else if (args[0] === "deleteMarker" || args[0] === "deleteLine" || args[0] == "deleteType" || args[0] === "deleteView") {
			return [[args[0], args[2]]];
		} else if (args[0] === "routePoints" && args[2].reset) {
			if (args[1] === "") {
				return [["routePoints", args[2].trackPoints]];
			} else {
				return [["routePointsWithId", { routeId: args[1], trackPoints: args[2].trackPoints }]];
			}
		} else {
			return [];
		}
	}

	async prepareAllMapObjects(streamId: StreamId<StreamToStreamId<AllMapObjectsItem<AllMapObjectsPick> | SetBboxItem>>): Promise<MultipleEvents<SocketEvents<SocketVersion.V2>>> {
		const resultStream = this.handleStream(streamId);
		const events: Array<SocketServerToClientEmitArgs<SocketVersion.V2>> = [];
		for await (const obj of streamToIterable(resultStream)) {
			if (obj.type === "mapData") {
				events.push(["padData", currentMapDataToLegacyV2(obj.data)]);
			} else if (obj.type === "markers") {
				for await (const marker of streamToIterable(this.handleStream(obj.data))) {
					events.push(["marker", currentMarkerToLegacyV2(marker, this.types[marker.typeId], this.readId!)]);
				}
			} else if (obj.type === "lines") {
				for await (const line of streamToIterable(this.handleStream(obj.data))) {
					events.push(["line", currentLineToLegacyV2(line, this.types[line.typeId], this.readId!)]);
				}
			} else if (obj.type === "linePoints") {
				for await (const linePoints of streamToIterable(this.handleStream(obj.data))) {
					events.push(["linePoints", {
						id: linePoints.lineId,
						trackPoints: linePoints.trackPoints,
						reset: false
					}]);
				}
			} else if (obj.type === "types") {
				for await (const type of streamToIterable(this.handleStream(obj.data))) {
					events.push(["type", currentTypeToLegacyV2(type, this.readId!)]);
				}
			} else if (obj.type === "views") {
				for await (const view of streamToIterable(this.handleStream(obj.data))) {
					events.push(["view", currentViewToLegacyV2(view, this.readId!)]);
				}
			}
		}
		const multipleEvents: MultipleEvents<SocketEvents<SocketVersion.V2>> = {};
		for (const [eventName, data] of events) {
			if (!multipleEvents[eventName]) {
				multipleEvents[eventName] = [];
			}
			(multipleEvents as any)[eventName].push(data);
		}
		return multipleEvents;
	}

	handleStream<T>(streamId: StreamId<T>): ReadableStream<T> {
		const stream = new TransformStream();
		this.streams[streamId] = stream.writable.getWriter();
		return stream.readable;
	}

	/**
	 * Pauses the emission of the specified event types while the (async) callback is running and returns all the intercepted events at the end.
	 */
	async interceptEvents(eventTypes: Array<keyof SocketEvents<SocketVersion.V2>> | ((...args: SocketServerToClientEmitArgs<SocketVersion.V2>) => boolean), callback: () => Promise<void>): Promise<MultipleEvents<SocketEvents<SocketVersion.V2>>> {
		const events: MultipleEvents<SocketEvents<SocketVersion.V2>> = {};
		const interceptor = (...args: SocketServerToClientEmitArgs<SocketVersion.V2>) => {
			if (typeof eventTypes === "function" ? eventTypes(...args) : eventTypes.includes(args[0])) {
				if (!events[args[0]]) {
					events[args[0]] = [];
				}
				(events as any)[args[0]].push(args[1]);
				return true;
			}
		};
		this.eventInterceptors.push(interceptor);

		try {
			await callback();
			return events;
		} finally {
			this.eventInterceptors = this.eventInterceptors.filter((i) => i !== interceptor);
		}
	}

	getSocketHandlers(): SocketHandlers<SocketVersion.V2> {
		const socketHandlersV3 = this.socketV3.getSocketHandlers();

		return {
			...pick(socketHandlersV3, [
				"geoip", "setLanguage"
			]),

			getPad: async (data) => {
				try {
					const mapData = await socketHandlersV3.getMap(data.padId);
					return {
						id: mapData.readId,
						name: mapData.name,
						description: mapData.description
					};
				} catch (err: any) {
					if (err.status === 404) {
						return null;
					} else {
						throw err;
					}
				}
			},

			findPads: async ({ query, ...paging }) => {
				const result = await socketHandlersV3.findMaps(query, paging);
				return {
					...result,
					results: result.results.map((r) => currentMapDataToLegacyV2(r))
				};
			},

			createPad: async (data) => {
				if(this.mapSlug) {
					throw new Error(getI18n().t("socket.map-already-loaded-error"));
				}

				const multiple = await this.interceptEvents(["padData", "marker", "line", "linePoints", "type", "view"], async () => {
					await socketHandlersV3.createMapAndSubscribe(legacyV2MapDataToCurrent(data));
				});

				console.log(multiple);

				const mapData = multiple.padData![0];
				this.mapSlug = getMapSlug(legacyV2MapDataToCurrent(mapData));
				console.log("mapSlug", this.mapSlug, mapData, legacyV2MapDataToCurrent(mapData));
				this.readId = mapData.id;
				this.writable = mapData.writable;

				return multiple;
			},

			editPad: async (mapData) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				return currentMapDataToLegacyV2(await socketHandlersV3.updateMap(this.mapSlug, legacyV2MapDataToCurrent(mapData)));
			},

			deletePad: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				await socketHandlersV3.deleteMap(this.mapSlug);
			},

			findOnMap: async (data) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const results = await socketHandlersV3.findOnMap(this.mapSlug, data.query);
				return results.map((result) => prepareMapResultOutput(result, this.types[result.typeId], this.readId!));
			},

			getMarker: async (data) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const marker = await socketHandlersV3.getMarker(this.mapSlug, data.id);
				return currentMarkerToLegacyV2(marker, this.types[marker.typeId], this.readId);
			},

			addMarker: async (marker) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const result = await socketHandlersV3.createMarker(this.mapSlug, legacyV2MarkerToCurrent(marker, this.types[marker.typeId]));
				return currentMarkerToLegacyV2(result, this.types[result.typeId], this.readId);
			},

			editMarker: async (marker) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const { id, ...data } = marker;

				return currentMarkerToLegacyV2(await socketHandlersV3.updateMarker(this.mapSlug, id, legacyV2MarkerToCurrent(data)), this.readId);
			},

			deleteMarker: async (data) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const marker = currentMarkerToLegacyV2(await socketHandlersV3.getMarker(this.mapSlug, data.id), this.readId);
				await socketHandlersV3.deleteMarker(this.mapSlug, data.id);
				return marker;
			},

			getLineTemplate: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const type = await socketHandlersV3.getType(this.mapSlug, data.typeId);
				return getLineTemplate(type);
			},

			addLine: async (line) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				return currentLineToLegacyV2(await socketHandlersV3.createLine(this.mapSlug, line), this.readId)
			},

			editLine: async (line) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const { id, ...data } = line;
				return currentLineToLegacyV2(await socketHandlersV3.updateLine(this.mapSlug, id, data), this.readId);
			},

			deleteLine: async (data) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const line = currentLineToLegacyV2(await socketHandlersV3.getLine(this.mapSlug, data.id), this.readId);
				await socketHandlersV3.deleteLine(this.mapSlug, data.id);
				return line;
			},

			exportLine: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}
				const result = await socketHandlersV3.exportLine(this.mapSlug, data.id, { format: data.format });
				return await streamToString(this.handleStream(result.data).pipeThrough(new TextDecoderStream()));
			},

			addType: async (type) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				return currentTypeToLegacyV2(await socketHandlersV3.createType(this.mapSlug, legacyV2TypeToCurrent(type)), this.readId)
			},

			editType: async (type) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const { id, ...data } = type;
				return currentTypeToLegacyV2(await socketHandlersV3.updateType(this.mapSlug, id, legacyV2TypeToCurrent(data)), this.readId);
			},

			deleteType: async (data) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const type = currentTypeToLegacyV2(await socketHandlersV3.getType(this.mapSlug, data.id), this.readId);
				await socketHandlersV3.deleteType(this.mapSlug, data.id);
				return type;
			},

			addView: async (view) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				return currentViewToLegacyV2(await socketHandlersV3.createView(this.mapSlug, view), this.readId);
			},

			editView: async (view) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const { id, ...data } = view;
				return currentViewToLegacyV2(await socketHandlersV3.updateView(this.mapSlug, id, data), this.readId);
			},

			deleteView: async (data) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const view = currentViewToLegacyV2(await socketHandlersV3.getView(this.mapSlug, data.id), this.readId);
				await socketHandlersV3.deleteView(this.mapSlug, data.id);
				return view;
			},

			find: async (data) => {
				if (data.loadUrls) {
					const url = parseUrlQuery(data.query);
					if (url) {
						const result = await socketHandlersV3.findUrl(url);
						return await streamToString(this.handleStream(result.data).pipeThrough(new TextDecoderStream()));
					}
				}

				return await socketHandlersV3.find(data.query);
			},

			getRoute: async (data) => {
				return await socketHandlersV3.getRoute(legacyV2RouteRequestToCurrent(data));
			},

			setPadId: async (mapSlug) => {
				if(this.mapSlug != null)
					throw new Error(getI18n().t("socket.map-id-set-error"));

				this.mapSlug = mapSlug;

				const multiple = await this.interceptEvents(["padData", "marker", "line", "linePoints", "type", "view"], async () => {
					try {
						await socketHandlersV3.subscribeToMap(mapSlug);
					} catch (err: any) {
						if (err.status === 404) {
							this.mapSlug = undefined;
							throw Object.assign(new Error(getI18n().t("socket.map-not-exist-error")), {
								name: "PadNotFoundError"
							});
						} else {
							throw err;
						}
					}
				});

				const mapData = multiple.padData![0];
				this.readId = mapData.id;
				this.writable = mapData.writable;

				return multiple;
			},

			listenToHistory: async () => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				if (this.listeningToHistory) {
					throw new Error(getI18n().t("socket.already-listening-to-history-error"));
				}

				this.listeningToHistory = true;
				await socketHandlersV3.subscribeToMap(this.mapSlug, { history: true });

				return {
					history: (await socketHandlersV3.getHistory(this.mapSlug)).map((h) => currentHistoryEntryToLegacyV2(h, this.readId!))
				};
			},

			stopListeningToHistory: async () => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				if(!this.listeningToHistory) {
					throw new Error(getI18n().t("socket.not-listening-to-history-error"));
				}

				this.listeningToHistory = false;
				await socketHandlersV3.subscribeToMap(this.mapSlug, { history: false });
			},

			updateBbox: async (bbox) => {
				return await this.interceptEvents(["marker", "linePoints", "routePoints"], async () => {
					await socketHandlersV3.setBbox(bbox);
				});
			},

			revertHistoryEntry: async (entry) => {
				if (!this.mapSlug || !this.readId) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				this.pauseHistoryListener++;
				try {
					await socketHandlersV3.revertHistoryEntry(this.mapSlug, entry.id);
				} finally {
					this.pauseHistoryListener--;
				}

				return {
					history: (await socketHandlersV3.getHistory(this.mapSlug)).map((h) => currentHistoryEntryToLegacyV2(h, this.readId!))
				};
			},

			setRoute: async (data) => {
				const { routeId, routePoints, mode } = data;

				this.routeAborts[routeId ?? ""]?.abort();
				const abort = this.routeAborts[routeId ?? ""] = new AbortController();

				await socketHandlersV3.subscribeToRoute(routeId ?? "", { routePoints, mode });

				if (!abort.signal.aborted) {
					return {
						...this.routes[routeId ?? ""],
						...(routeId ? { routeId } : {})
					};
				}
			},

			clearRoute: async (data) => {
				const { routeId } = data ?? {};

				this.routeAborts[routeId ?? ""]?.abort();
				delete this.routes[routeId ?? ""];
				await socketHandlersV3.unsubscribeFromRoute(data?.routeId ?? "");
			},

			lineToRoute: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const { id, routeId } = data;
				this.routeAborts[routeId ?? ""]?.abort();
				const abort = this.routeAborts[routeId ?? ""] = new AbortController();

				await socketHandlersV3.subscribeToRoute(routeId ?? "", { mapSlug: this.mapSlug, lineId: id });

				if (!abort.signal.aborted) {
					return {
						...this.routes[routeId ?? ""],
						...(routeId ? { routeId } : {})
					};
				}
			},

			exportRoute: async (data) => {
				const { routeId, format } = data;
				const result = await socketHandlersV3.exportRoute(routeId ?? "", { format });
				return await streamToString(this.handleStream(result.data).pipeThrough(new TextDecoderStream()));
			}

		};
	}

	handleDisconnect(): void {
		this.socketV3.handleDisconnect();
	}

}