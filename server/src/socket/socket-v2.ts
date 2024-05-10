import { SocketVersion, type SocketEvents, type MultipleEvents, type FindOnMapResult, type SocketServerToClientEmitArgs, legacyV2MarkerToCurrent, currentMarkerToLegacyV2, currentTypeToLegacyV2, legacyV2TypeToCurrent, mapHistoryEntry, MapNotFoundError, currentLineToLegacyV2, currentViewToLegacyV2, currentHistoryEntryToLegacyV2, type StreamId, type MapSlug, type MapId, type BboxWithZoom, Writable, DEFAULT_PAGING } from "facilmap-types";
import { mapMultipleEvents, type SocketConnection, type SocketHandlers } from "./socket-common";
import { SocketConnectionV3 } from "./socket-v3";
import type Database from "../database/database";
import { omit } from "lodash-es";
import { streamToIterable } from "../utils/streams";
import type { RouteWithId } from "../database/route";
import { getI18n } from "../i18n";
import { getLineTemplate } from "facilmap-utils";

function prepareEvent(...args: SocketServerToClientEmitArgs<SocketVersion.V3>): Array<SocketServerToClientEmitArgs<SocketVersion.V2>> {
	if (args[0] === "marker") {
		return [[args[0], currentMarkerToLegacyV2(args[1])]];
	} else if (args[0] === "line") {
		return [[args[0], currentLineToLegacyV2(args[1])]];
	} else if (args[0] === "type") {
		return [[args[0], currentTypeToLegacyV2(args[1])]];
	} else if (args[0] === "view") {
		return [[args[0], currentViewToLegacyV2(args[1])]];
	} else if (args[0] === "history") {
		if (args[1].type === "Marker") {
			return [[
				args[0],
				currentHistoryEntryToLegacyV2(mapHistoryEntry(args[1], (obj) => obj && currentMarkerToLegacyV2(obj)))
			]];
		} else if (args[1].type === "Line") {
			return [[
				args[0],
				currentHistoryEntryToLegacyV2(mapHistoryEntry(args[1], (obj) => obj && currentLineToLegacyV2(obj)))
			]];
		} else if (args[1].type === "Type") {
			return [[
				args[0],
				currentHistoryEntryToLegacyV2(mapHistoryEntry(args[1], (obj) => obj && currentTypeToLegacyV2(obj)))
			]];
		} else if (args[1].type === "View") {
			return [[
				args[0],
				currentHistoryEntryToLegacyV2(mapHistoryEntry(args[1], (obj) => obj && currentViewToLegacyV2(obj)))
			]];
		} else {
			return [[args[0], currentHistoryEntryToLegacyV2(args[1])]];
		}
	} else if (args[0] === "mapData") {
		return [["padData", args[1]]];
	} else if (args[0] === "deleteMap") {
		return [["deletePad"]];
	} else {
		return [args];
	}
}

function prepareMultiple(events: MultipleEvents<SocketEvents<SocketVersion.V3>>): MultipleEvents<SocketEvents<SocketVersion.V2>> {
	return mapMultipleEvents(events, prepareEvent);
}

function prepareMapResultOutput(result: FindOnMapResult) {
	if (result.kind === "marker") {
		return currentMarkerToLegacyV2(result);
	} else {
		return result;
	}
}

async function objectStreamToMultipleEvents<T extends [string, any]>(stream: ReadableStream<T>): Promise<{
	[Key in T[0]]: Array<Extract<T, [Key, any]>[1]>;
}> {
	const result: any = {};
	for await (const [key, object] of streamToIterable(stream)) {
		if (!result[key]) {
			result[key] = [];
		}
		result[key].push(object);
	}
	return result;
}

export class SocketConnectionV2 implements SocketConnection<SocketVersion.V2> {
	socketV3: SocketConnectionV3;
	streams: Record<StreamId, WritableStreamDefaultWriter<any[]>> = {};

	mapSlug: MapSlug | undefined = undefined;
	mapId: MapId | undefined = undefined;
	bbox: BboxWithZoom | undefined = undefined;
	writable: Writable | undefined = undefined;
	route: Omit<RouteWithId, "trackPoints"> | undefined = undefined;
	routes: Record<string, Omit<RouteWithId, "trackPoints">> = { };
	pauseHistoryListener = 0;

	constructor(emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V2>) => void, database: Database, remoteAddr: string) {
		this.socketV3 = new SocketConnectionV3((...args) => {
			for (const ev of prepareEvent(...args)) {
				if (ev[0] === "streamChunks") {
					void this.streams[ev[1].streamId].write(ev[1].chunks);
				} else if (ev[0] === "streamDone") {
					void this.streams[ev[1].streamId].close();
				} else {
					emit(...ev);
				}
			}
		}, database, remoteAddr);
	}

	handleStream(streamId: StreamId): ReadableStream<any> {
		const stream = new TransformStream();
		this.streams[streamId] = stream.writable.getWriter();
		return stream.readable;
	}

	getSocketHandlers(): SocketHandlers<SocketVersion.V2> {
		const socketHandlersV3 = this.socketV3.getSocketHandlers();

		return {
			...omit(socketHandlersV3, ["getMap", "findMaps", "createMap", "editMap", "deleteMap", "setMapId"]),

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
				const result = await socketHandlersV3.createMap(data);
				const resultStream = this.handleStream(result.results);
				const multiple = prepareMultiple(await objectStreamToMultipleEvents(resultStream));
				const mapData = multiple.padData![0];
				this.mapSlug = mapData.adminId;
				this.mapId = mapData.id;
				this.writable = Writable.ADMIN;
				return multiple;
			},

			editPad: async (mapData) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				await socketHandlersV3.updateMap(this.mapSlug, mapData);
			},

			deletePad: async (data) => {
				if (!this.mapSlug) {
					throw new Error(getI18n().t("socket.no-map-open-error"));
				}

				const mapData = socketHandlersV3.getMap(this.mapSlug);
				await socketHandlersV3.deleteMap(this.mapSlug);
				return mapData;
			},

			setPadId: async (mapId) => {
				try {
					return prepareMultiple(await socketHandlersV3.setMapId(mapId));
				} catch (err: any) {
					if (err instanceof MapNotFoundError) {
						err.name = "PadNotFoundError";
					}
					throw err;
				}
			},

			updateBbox: async (bbox) => prepareMultiple(await socketHandlersV3.updateBbox(bbox)),

			listenToHistory: async (data) => prepareMultiple(await socketHandlersV3.listenToHistory(data)),

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

				return prepareMultiple({
					history: await socketHandlersV3.getHistory(this.mapSlug, DEFAULT_PAGING)
				});
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

			editLine: async (line) => currentLineToLegacyV2(await socketHandlersV3.editLine(line)),

			deleteLine: async (data) => currentLineToLegacyV2(await socketHandlersV3.deleteLine(data)),

			addView: async (view) => currentViewToLegacyV2(await socketHandlersV3.addView(view)),

			editView: async (view) => currentViewToLegacyV2(await socketHandlersV3.editView(view)),

			deleteView: async (view) => currentViewToLegacyV2(await socketHandlersV3.deleteView(view)),

			addType: async (type) => currentTypeToLegacyV2(await socketHandlersV3.addType(legacyV2TypeToCurrent(type))),

			editType: async (type) => currentTypeToLegacyV2(await socketHandlersV3.editType(legacyV2TypeToCurrent(type))),

			deleteType: async (data) => currentTypeToLegacyV2(await socketHandlersV3.deleteType(data))

			findOnMap: async (data) => (await socketHandlersV3.findOnMap(data)).map((result) => prepareMapResultOutput(result)),

		};
	}

	handleDisconnect(): void {
		this.socketV3.handleDisconnect();
	}

}