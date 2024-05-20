import { SocketVersion, type SocketEvents, type MultipleEvents, type FindOnMapResult, type SocketServerToClientEmitArgs, legacyV2MarkerToCurrent, currentMarkerToLegacyV2, currentTypeToLegacyV2, legacyV2TypeToCurrent, currentLineToLegacyV2, currentViewToLegacyV2, currentHistoryEntryToLegacyV2, type StreamId, type MapSlug, type MapId, type BboxWithZoom, Writable, type Route, type AllMapObjectsPick, type AllMapObjectsItem, type StreamToStreamId, type BboxItem } from "facilmap-types";
import { type SocketConnection, type SocketHandlers } from "./socket-common";
import { SocketConnectionV3 } from "./socket-v3";
import type Database from "../database/database";
import { pick } from "lodash-es";
import { streamToIterable, streamToString } from "../utils/streams";
import { getI18n } from "../i18n";
import { getLineTemplate, getMapSlug, parseUrlQuery } from "facilmap-utils";
import { deserializeError } from "serialize-error";

function prepareMapResultOutput(result: FindOnMapResult) {
	if (result.kind === "marker") {
		return currentMarkerToLegacyV2(result);
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
	mapId: MapId | undefined = undefined;
	bbox: BboxWithZoom | undefined = undefined;
	writable: Writable | undefined = undefined;
	route: Omit<Route, "trackPoints"> | undefined = undefined;
	routes: Record<string, Omit<Route, "trackPoints">> = { };
	listeningToHistory = false;
	pauseHistoryListener = 0;

	constructor(emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V2>) => void, database: Database, remoteAddr: string) {
		this.socketV3 = new SocketConnectionV3((...args) => {
			if (args[0] === "streamChunks") {
				this.streams[args[1]].write(args[2]).catch(() => undefined);
			} else if (args[0] === "streamDone") {
				this.streams[args[1]].close().catch(() => undefined);
			} else if (args[0] === "streamError") {
				this.streams[args[1]].abort(deserializeError(args[1])).catch(() => undefined);
			} else {
				for (const ev of this.prepareEvent(...args)) {
					emit(...ev);
				}
			}
		}, database, remoteAddr);
	}

	prepareEvent(...args: SocketServerToClientEmitArgs<SocketVersion.V3>): Array<SocketServerToClientEmitArgs<SocketVersion.V2>> {
		if (args[0] === "marker") {
			return [[args[0], currentMarkerToLegacyV2(args[2])]];
		} else if (args[0] === "line") {
			return [[args[0], currentLineToLegacyV2(args[2])]];
		} else if (args[0] === "type") {
			return [[args[0], currentTypeToLegacyV2(args[2])]];
		} else if (args[0] === "view") {
			return [[args[0], currentViewToLegacyV2(args[2])]];
		} else if (args[0] === "history") {
			if (this.pauseHistoryListener) {
				return [];
			}

			return [[args[0], currentHistoryEntryToLegacyV2(args[2])]];
		} else if (args[0] === "mapData") {
			return [["padData", args[2]]];
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
		} else {
			return [];
		}
	}

	async prepareAllMapObjects(streamId: StreamId<StreamToStreamId<AllMapObjectsItem<AllMapObjectsPick> | BboxItem>>): Promise<MultipleEvents<SocketEvents<SocketVersion.V2>>> {
		const resultStream = this.handleStream(streamId);
		const events: Array<SocketServerToClientEmitArgs<SocketVersion.V2>> = [];
		for await (const obj of streamToIterable(resultStream)) {
			if (obj.type === "mapData") {
				events.push(["padData", obj.data]);
			} else if (obj.type === "markers") {
				for await (const marker of streamToIterable(this.handleStream(obj.data))) {
					events.push(["marker", currentMarkerToLegacyV2(marker)]);
				}
			} else if (obj.type === "lines") {
				for await (const line of streamToIterable(this.handleStream(obj.data))) {
					events.push(["line", currentLineToLegacyV2(line)]);
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
					events.push(["type", currentTypeToLegacyV2(type)]);
				}
			} else if (obj.type === "views") {
				for await (const view of streamToIterable(this.handleStream(obj.data))) {
					events.push(["view", currentViewToLegacyV2(view)]);
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

	getSocketHandlers(): SocketHandlers<SocketVersion.V2> {
		const socketHandlersV3 = this.socketV3.getSocketHandlers();

		return {
			...pick(socketHandlersV3, [
				"getRoute", "geoip", "setLanguage"
			]),

			getPad: async (data) => {
				const mapData = await socketHandlersV3.getMap(data.padId);
				return mapData && {
					id: mapData.id,
					name: mapData.name,
					description: mapData.description
				};
			},

			findPads: async ({ query, ...paging }) => await socketHandlersV3.findMaps(query, paging),

			createPad: async (data) => {
				if(this.mapSlug) {
					throw new Error(getI18n().t("socket.map-already-loaded-error"));
				}

				const multiple = await this.prepareAllMapObjects(await socketHandlersV3.createMap(data));

				const mapData = multiple.padData![0];
				this.mapSlug = getMapSlug(mapData);
				this.mapId = mapData.id;
				this.writable = mapData.writable;

				return multiple;
			},

			editPad: async (mapData) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				return await socketHandlersV3.updateMap(this.mapSlug, mapData);
			},

			deletePad: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				await socketHandlersV3.deleteMap(this.mapSlug);
			},

			findOnMap: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const results = await socketHandlersV3.findOnMap(this.mapSlug, data.query);
				return results.map((result) => prepareMapResultOutput(result));
			},

			getMarker: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				return currentMarkerToLegacyV2(await socketHandlersV3.getMarker(this.mapSlug, data.id));
			},

			addMarker: async (marker) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				return currentMarkerToLegacyV2(await socketHandlersV3.createMarker(this.mapSlug, legacyV2MarkerToCurrent(marker)));
			},

			editMarker: async (marker) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const { id, ...data } = marker;

				return currentMarkerToLegacyV2(await socketHandlersV3.updateMarker(this.mapSlug, id, legacyV2MarkerToCurrent(data)));
			},

			deleteMarker: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const marker = currentMarkerToLegacyV2(await socketHandlersV3.getMarker(this.mapSlug, data.id));
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
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				return currentLineToLegacyV2(await socketHandlersV3.createLine(this.mapSlug, line))
			},

			editLine: async (line) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const { id, ...data } = line;
				return currentLineToLegacyV2(await socketHandlersV3.updateLine(this.mapSlug, id, data));
			},

			deleteLine: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const line = currentLineToLegacyV2(await socketHandlersV3.getLine(this.mapSlug, data.id));
				await socketHandlersV3.deleteLine(this.mapSlug, data.id);
				return line;
			},

			exportLine: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}
				const result = await socketHandlersV3.exportLine(this.mapSlug, data.id, { format: data.format });
				return await streamToString(this.handleStream(result.data));
			},

			addType: async (type) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				return currentTypeToLegacyV2(await socketHandlersV3.createType(this.mapSlug, legacyV2TypeToCurrent(type)))
			},

			editType: async (type) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const { id, ...data } = type;
				return currentTypeToLegacyV2(await socketHandlersV3.updateType(this.mapSlug, id, legacyV2TypeToCurrent(data)));
			},

			deleteType: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const type = currentTypeToLegacyV2(await socketHandlersV3.getType(this.mapSlug, data.id));
				await socketHandlersV3.deleteType(this.mapSlug, data.id);
				return type;
			},

			addView: async (view) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				return currentViewToLegacyV2(await socketHandlersV3.createView(this.mapSlug, view));
			},

			editView: async (view) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const { id, ...data } = view;
				return currentViewToLegacyV2(await socketHandlersV3.updateView(this.mapSlug, id, data));
			},

			deleteView: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const view = currentViewToLegacyV2(await socketHandlersV3.getView(this.mapSlug, data.id));
				await socketHandlersV3.deleteView(this.mapSlug, data.id);
				return view;
			},

			find: async (data) => {
				if (data.loadUrls) {
					const url = parseUrlQuery(data.query);
					if (url) {
						const result = await socketHandlersV3.findUrl(url);
						return await streamToString(this.handleStream(result.data));
					}
				}

				return await socketHandlersV3.find(data.query);
			},

			setPadId: async (mapSlug) => {
				if(this.mapSlug != null)
					throw new Error(getI18n().t("socket.map-id-set-error"));

				this.mapSlug = mapSlug;

				let results;
				try {
					results = await socketHandlersV3.subscribeToMap(mapSlug);
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

				const multiple = await this.prepareAllMapObjects(results);

				const mapData = multiple.padData![0];
				this.mapId = mapData.id;
				this.writable = mapData.writable;

				// const result = await socketHandlersV3.getAllMapObjects(mapSlug, {
				// 	pick: ["mapData", "views", "types", "lines", ...this.bbox ? ["markers" as const, "linePoints" as const] : []],
				// 	bbox: this.bbox
				// });

				return multiple;
			},

			listenToHistory: async () => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				if (this.listeningToHistory) {
					throw new Error(getI18n().t("socket.already-listening-to-history-error"));
				}

				this.listeningToHistory = true;
				await socketHandlersV3.subscribeToMap(this.mapSlug, { history: true });

				return {
					history: (await socketHandlersV3.getHistory(this.mapSlug)).map((h) => currentHistoryEntryToLegacyV2(h))
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
				const results = await socketHandlersV3.setBbox(bbox);
				return await this.prepareAllMapObjects(results);
			},

			revertHistoryEntry: async (entry) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				this.pauseHistoryListener++;
				try {
					await socketHandlersV3.revertHistoryEntry(this.mapSlug, entry.id);
				} finally {
					this.pauseHistoryListener--;
				}

				return {
					history: (await socketHandlersV3.getHistory(this.mapSlug)).map((h) => currentHistoryEntryToLegacyV2(h))
				};
			},

			setRoute: async (data) => {
				const { routeId, routePoints, mode } = data;
				const result = await socketHandlersV3.subscribeToRoute(routeId ?? "", { routePoints, mode });
				return result && { ...result, routeId };
			},

			clearRoute: async (data) => {
				await socketHandlersV3.unsubscribeFromRoute(data?.routeId ?? "");
			},

			lineToRoute: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const { id, routeId } = data;
				const result = await socketHandlersV3.subscribeToRoute(routeId ?? "", { mapSlug: this.mapSlug, lineId: id });
				return result && { ...result, routeId };
			},

			exportRoute: async (data) => {
				const { routeId, format } = data;
				const result = await socketHandlersV3.exportRoute(routeId ?? "", { format });
				return await streamToString(this.handleStream(result.data));
			}

		};
	}

	handleDisconnect(): void {
		this.socketV3.handleDisconnect();
	}

}