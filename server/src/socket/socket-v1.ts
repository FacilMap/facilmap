import { SocketVersion, type SocketEvents, type MultipleEvents, type FindOnMapLine, type SocketServerToClientEmitArgs, type LegacyV2FindOnMapMarker, type LegacyV2Marker, type LegacyV2FindOnMapResult, type LegacyV2Line, type LegacyV2MapData, type LegacyV2FindMapsResult } from "facilmap-types";
import { SocketConnectionV2, mapMultipleEvents } from "./socket-v2";
import { type SocketConnection, type SocketHandlers } from "./socket-common";
import { normalizeLineName, normalizeMarkerName, normalizeMapName } from "facilmap-utils";
import type Database from "../database/database";

function prepareMapData<P extends LegacyV2MapData | LegacyV2FindMapsResult>(mapData: P): P {
	return {
		...mapData,
		name: normalizeMapName(mapData.name)
	};
}

function prepareMarker<M extends LegacyV2Marker | LegacyV2FindOnMapMarker>(marker: M): M {
	return {
		...marker,
		name: normalizeMarkerName(marker.name)
	};
}

function prepareLine<L extends LegacyV2Line | FindOnMapLine>(line: L): L {
	return {
		...line,
		name: normalizeLineName(line.name)
	};
}

function prepareMapResult(result: LegacyV2FindOnMapResult): LegacyV2FindOnMapResult {
	if (result.kind === "marker") {
		return prepareMarker(result);
	} else {
		return prepareLine(result);
	}
}

function prepareEvent(...args: SocketServerToClientEmitArgs<SocketVersion.V2>): Array<SocketServerToClientEmitArgs<SocketVersion.V1>> {
	if (args[0] === "line") {
		return [["line", prepareLine(args[1])]];
	} else if (args[0] === "marker") {
		return [["marker", prepareMarker(args[1])]];
	} else if (args[0] === "padData") {
		return [["padData", prepareMapData(args[1])]];
	} else {
		return [args];
	}
}

function prepareMultiple(events: MultipleEvents<SocketEvents<SocketVersion.V2>>): MultipleEvents<SocketEvents<SocketVersion.V1>> {
	return mapMultipleEvents(events, prepareEvent);
}

function mapResult<Input, Output, Args extends any[]>(func: (...args: Args) => Input | PromiseLike<Input>, mapper: (result: Input) => Output): (...args: Args) => Promise<Output> {
	return async (...args) => {
		const result = await func(...args);
		return mapper(result);
	};
}

export class SocketConnectionV1 implements SocketConnection<SocketVersion.V1> {
	socketV2: SocketConnectionV2;

	constructor(emit: (...args: SocketServerToClientEmitArgs<SocketVersion.V1>) => void, database: Database, remoteAddr: string) {
		this.socketV2 = new SocketConnectionV2((...args) => {
			for (const ev of prepareEvent(...args)) {
				emit(...ev);
			}
		}, database, remoteAddr);
	}

	getSocketHandlers(): SocketHandlers<SocketVersion.V1> {
		const socketHandlersV2 = this.socketV2.getSocketHandlers();

		return {
			...socketHandlersV2,
			setPadId: mapResult(socketHandlersV2.setPadId, (events) => prepareMultiple(events)),
			updateBbox: mapResult(socketHandlersV2.updateBbox, (events) => prepareMultiple(events)),
			getPad: mapResult(socketHandlersV2.getPad, (result) => result ? prepareMapData(result) : result),
			findPads: mapResult(socketHandlersV2.findPads, (result) => ({ ...result, results: result.results.map((r) => prepareMapData(r)) })),
			createPad: mapResult(socketHandlersV2.createPad, (events) => prepareMultiple(events)),
			editPad: mapResult(socketHandlersV2.editPad, (mapData) => prepareMapData(mapData)),
			getMarker: mapResult(socketHandlersV2.getMarker, (marker) => prepareMarker(marker)),
			addMarker: mapResult(socketHandlersV2.addMarker, (marker) => prepareMarker(marker)),
			editMarker: mapResult(socketHandlersV2.editMarker, (marker) => prepareMarker(marker)),
			deleteMarker: mapResult(socketHandlersV2.deleteMarker, (marker) => prepareMarker(marker)),
			addLine: mapResult(socketHandlersV2.addLine, (line) => prepareLine(line)),
			editLine: mapResult(socketHandlersV2.editLine, (line) => prepareLine(line)),
			deleteLine: mapResult(socketHandlersV2.deleteLine, (line) => prepareLine(line)),
			findOnMap: mapResult(socketHandlersV2.findOnMap, (results) => results.map((r) => prepareMapResult(r)))
		};
	}

	handleDisconnect(): void {
		this.socketV2.handleDisconnect();
	}

}