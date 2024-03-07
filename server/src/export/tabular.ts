import { flatMapStream, asyncIteratorToStream, mapStream } from "../utils/streams.js";
import { compileExpression, formatField, formatRouteMode, formatTime, normalizeLineName, normalizeMarkerName, round } from "facilmap-utils";
import type { PadId, ID } from "facilmap-types";
import Database from "../database/database.js";
import { ReadableStream } from "stream/web";

export async function getTabularData(
	database: Database,
	padId: PadId,
	typeId: ID,
	html: boolean,
	filter?: string,
	hide: string[] = []
): Promise<{
	fields: string[];
	objects: ReadableStream<Record<string, string>>;
}> {
	const padData = await database.pads.getPadData(padId);
	if (!padData)
		throw new Error(`Pad ${padId} could not be found.`);

	const type = await database.types.getType(padData.id, typeId);

	const filterFunc = compileExpression(filter);

	const fields = [
		"Name",
		...(type.type === "marker" ? [
			"Position"
		] : type.type === "line" ? [
			"Distance",
			"Time"
		] : []),
		...type.fields.map((f) => f.name)
	].filter((f) => !hide.includes(f));

	const objects = type.type === "marker" ? flatMapStream(asyncIteratorToStream(database.markers.getPadMarkersByType(padId, typeId)), (marker): Array<Record<string, () => string>> => {
		if (!filterFunc(marker, type)) {
			return [];
		}

		return [{
			"Name": () => normalizeMarkerName(marker.name),
			"Position": () => `${round(marker.lat, 5)},${round(marker.lon, 5)}`,
			...Object.fromEntries(type.fields.map((f) => [f.name, () => formatField(f, marker.data[f.name], html).trim()]))
		}];
	}) : flatMapStream(asyncIteratorToStream(database.lines.getPadLinesByType(padId, typeId)), (line): Array<Record<string, () => string>> => {
		if (!filterFunc(line, type)) {
			return [];
		}

		return [{
			"Name": () => normalizeLineName(line.name),
			"Distance": () => `${round(line.distance, 2)}\u202Fkm`,
			"Time": () => line.time != null ? `${formatTime(line.time)}\u202Fh ${formatRouteMode(line.mode)}` : "",
			...Object.fromEntries(type.fields.map((f) => [f.name, () => formatField(f, line.data[f.name], html).trim()]))
		}];
	});

	return {
		fields,
		objects: mapStream(objects, (obj) => Object.fromEntries(Object.entries(obj).flatMap(([k, v]) => fields.includes(k) ? [[k, v()]] : [])))
	};
}
