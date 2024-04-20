import { SocketVersion, type SocketEvents, type MultipleEvents, type MapData, type Line, type FindMapsResult, type FindOnMapLine, type SocketServerToClientEmitArgs, type LegacyV2FindOnMapMarker, type LegacyV2Marker, type LegacyV2FindOnMapResult } from "facilmap-types";
import { SocketConnectionV2 } from "./socket-v2";
import { mapMultipleEvents, type SocketConnection, type SocketHandlers } from "./socket-common";
import { normalizeLineName, normalizeMarkerName, normalizeMapName } from "facilmap-utils";
import type Database from "../database/database";

function prepareMapData<P extends MapData | FindMapsResult>(mapData: P): P {
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

function prepareLine<L extends Line | FindOnMapLine>(line: L): L {
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
		const socketHandlers = this.socketV2.getSocketHandlers();

		return {
			...socketHandlers,
			setPadId: mapResult(socketHandlers.setPadId, (events) => prepareMultiple(events)),
			updateBbox: mapResult(socketHandlers.updateBbox, (events) => prepareMultiple(events)),
			getPad: mapResult(socketHandlers.getPad, (result) => result ? prepareMapData(result) : result),
			findPads: mapResult(socketHandlers.findPads, (result) => ({ ...result, results: result.results.map((r) => prepareMapData(r)) })),
			createPad: mapResult(socketHandlers.createPad, (events) => prepareMultiple(events)),
			editPad: mapResult(socketHandlers.editPad, (mapData) => prepareMapData(mapData)),
			getMarker: mapResult(socketHandlers.getMarker, (marker) => prepareMarker(marker)),
			addMarker: mapResult(socketHandlers.addMarker, (marker) => prepareMarker(marker)),
			editMarker: mapResult(socketHandlers.editMarker, (marker) => prepareMarker(marker)),
			deleteMarker: mapResult(socketHandlers.deleteMarker, (marker) => prepareMarker(marker)),
			addLine: mapResult(socketHandlers.addLine, (line) => prepareLine(line)),
			editLine: mapResult(socketHandlers.editLine, (line) => prepareLine(line)),
			deleteLine: mapResult(socketHandlers.deleteLine, (line) => prepareLine(line)),
			findOnMap: mapResult(socketHandlers.findOnMap, (results) => results.map((r) => prepareMapResult(r)))
		};
	}

	handleDisconnect(): void {
		this.socketV2.handleDisconnect();
	}

}