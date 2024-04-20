import { SocketVersion, type SocketEvents, type MultipleEvents, type FindOnMapResult, type SocketServerToClientEmitArgs, legacyV2MarkerToCurrent, currentMarkerToLegacyV2, currentTypeToLegacyV2, legacyV2TypeToCurrent, mapHistoryEntry } from "facilmap-types";
import { mapMultipleEvents, type SocketConnection, type SocketHandlers } from "./socket-common";
import { SocketConnectionV3 } from "./socket-v3";
import type Database from "../database/database";

function prepareEvent(...args: SocketServerToClientEmitArgs<SocketVersion.V3>): Array<SocketServerToClientEmitArgs<SocketVersion.V2>> {
	if (args[0] === "marker") {
		return [[args[0], currentMarkerToLegacyV2(args[1])]];
	} else if (args[0] === "type") {
		return [[args[0], currentTypeToLegacyV2(args[1])]];
	} else if (args[0] === "history") {
		if (args[1].type === "Marker") {
			return [[
				args[0],
				mapHistoryEntry(args[1], (obj) => obj && currentMarkerToLegacyV2(obj))
			]];
		} else if (args[1].type === "Type") {
			return [[
				args[0],
				mapHistoryEntry(args[1], (obj) => obj && currentTypeToLegacyV2(obj))
			]];
		} else {
			return [[args[0], args[1]]];
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

export class SocketConnectionV2 implements SocketConnection<SocketVersion.V2> {
	socketV3: SocketConnectionV3;

	constructor(emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V2>) => void, database: Database, remoteAddr: string) {
		this.socketV3 = new SocketConnectionV3((...args) => {
			for (const ev of prepareEvent(...args)) {
				emit(...ev);
			}
		}, database, remoteAddr);
	}

	getSocketHandlers(): SocketHandlers<SocketVersion.V2> {
		const socketHandlers = this.socketV3.getSocketHandlers();

		return {
			...socketHandlers,

			addMarker: async (marker) => currentMarkerToLegacyV2(await socketHandlers.addMarker(legacyV2MarkerToCurrent(marker))),
			editMarker: async (marker) => currentMarkerToLegacyV2(await socketHandlers.editMarker(legacyV2MarkerToCurrent(marker))),
			addType: async (type) => currentTypeToLegacyV2(await socketHandlers.addType(legacyV2TypeToCurrent(type))),
			editType: async (type) => currentTypeToLegacyV2(await socketHandlers.editType(legacyV2TypeToCurrent(type))),

			updateBbox: async (bbox) => prepareMultiple(await socketHandlers.updateBbox(bbox)),
			createPad: async (mapData) => prepareMultiple(await socketHandlers.createPad(mapData)),
			listenToHistory: async (data) => prepareMultiple(await socketHandlers.listenToHistory(data)),
			revertHistoryEntry: async (entry) => prepareMultiple(await socketHandlers.revertHistoryEntry(entry)),
			getMarker: async (data) => currentMarkerToLegacyV2(await socketHandlers.getMarker(data)),
			deleteMarker: async (data) => currentMarkerToLegacyV2(await socketHandlers.deleteMarker(data)),
			findOnMap: async (data) => (await socketHandlers.findOnMap(data)).map((result) => prepareMapResultOutput(result)),
			deleteType: async (data) => currentTypeToLegacyV2(await socketHandlers.deleteType(data)),
			setPadId: async (mapId) => prepareMultiple(await socketHandlers.setPadId(mapId))
		};
	}

	handleDisconnect(): void {
		this.socketV3.handleDisconnect();
	}

}