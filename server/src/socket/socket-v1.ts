import { SocketVersion, type Marker, type SocketEvents, type MultipleEvents, type PadData, type Line, type FindPadsResult, type FindOnMapResult, type FindOnMapMarker, type FindOnMapLine, type SocketClientToServerEvents, type SocketServerToClientEvents } from "facilmap-types";
import { SocketConnectionV2 } from "./socket-v2";
import type { DatabaseHandlers, SocketHandlers } from "./socket-common";
import { normalizeLineName, normalizeMarkerName, normalizePadName } from "facilmap-utils";
import { type Socket as SocketIO } from "socket.io";

function mapResult<Input, Output, Args extends any[]>(func: (...args: Args) => Input | PromiseLike<Input>, mapper: (result: Input) => Output): (...args: Args) => Promise<Output> {
	return async (...args) => {
		const result = await func(...args);
		return mapper(result);
	};
}

export class SocketConnectionV1 extends SocketConnectionV2 {
	declare socket: SocketIO<SocketClientToServerEvents<SocketVersion.V2>, SocketServerToClientEvents<SocketVersion.V2>>;;

	override getVersion(): SocketVersion {
		return SocketVersion.V1;
	}

	override getSocketHandlers(): SocketHandlers<SocketVersion.V1> {
		const socketHandlers = super.getSocketHandlers();

		return {
			...socketHandlers,
			setPadId: mapResult(socketHandlers.setPadId, (events) => this.prepareMultiple(events)),
			updateBbox: mapResult(socketHandlers.updateBbox, (events) => this.prepareMultiple(events)),
			getPad: mapResult(socketHandlers.getPad, (result) => result ? this.preparePadData(result) : result),
			findPads: mapResult(socketHandlers.findPads, (result) => ({ ...result, results: result.results.map((r) => this.preparePadData(r)) })),
			createPad: mapResult(socketHandlers.createPad, (events) => this.prepareMultiple(events)),
			editPad: mapResult(socketHandlers.editPad, (padData) => this.preparePadData(padData)),
			getMarker: mapResult(socketHandlers.getMarker, (marker) => this.prepareMarker(marker)),
			addMarker: mapResult(socketHandlers.addMarker, (marker) => this.prepareMarker(marker)),
			editMarker: mapResult(socketHandlers.editMarker, (marker) => this.prepareMarker(marker)),
			deleteMarker: mapResult(socketHandlers.deleteMarker, (marker) => this.prepareMarker(marker)),
			getLineTemplate: mapResult(socketHandlers.getLineTemplate, (line) => this.prepareLine(line)),
			addLine: mapResult(socketHandlers.addLine, (line) => this.prepareLine(line)),
			editLine: mapResult(socketHandlers.editLine, (line) => this.prepareLine(line)),
			deleteLine: mapResult(socketHandlers.deleteLine, (line) => this.prepareLine(line)),
			findOnMap: mapResult(socketHandlers.findOnMap, (results) => results.map((r) => this.prepareMapResult(r)))
		};
	}

	override getDatabaseHandlers(): DatabaseHandlers {
		const databaseHandlers = super.getDatabaseHandlers();
		return {
			...databaseHandlers,
			...databaseHandlers.line ? { line: (padId, data) => { databaseHandlers.line!(padId, this.prepareLine(data)); } } : {},
			...databaseHandlers.marker ? { marker: (padId, data) => { databaseHandlers.marker!(padId, this.prepareMarker(data)); } } : {},
			...databaseHandlers.padData ? { padData: (padId, data) => { databaseHandlers.padData!(padId, this.preparePadData(data)); } } : {}
		};
	}

	prepareMultiple(events: MultipleEvents<SocketEvents<SocketVersion.V1>>): MultipleEvents<SocketEvents<SocketVersion.V1>> {
		return {
			...events,
			...(events.padData ? { padData: events.padData.map((p) => this.preparePadData(p)) } : {}),
			...(events.marker ? { marker: events.marker.map((m) => this.prepareMarker(m)) } : {}),
			...(events.line ? { line: events.line.map((l) => this.prepareLine(l)) } : {})
		};

	}

	preparePadData<P extends PadData | FindPadsResult>(padData: P): P {
		return {
			...padData,
			name: normalizePadName(padData.name)
		};
	}

	prepareMarker<M extends Marker | FindOnMapMarker>(marker: M): M {
		return {
			...marker,
			name: normalizeMarkerName(marker.name)
		};
	}

	prepareLine<L extends Line | FindOnMapLine>(line: L): L {
		return {
			...line,
			name: normalizeLineName(line.name)
		};
	}

	prepareMapResult(result: FindOnMapResult): FindOnMapResult {
		if (result.kind === "marker") {
			return this.prepareMarker(result);
		} else {
			return this.prepareLine(result);
		}
	}

}