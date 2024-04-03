import { flatMapStream, asyncIteratorToStream, mapStream } from "../utils/streams.js";
import { compileExpression, formatDistance, formatField, formatRouteTime, normalizeLineName, normalizeMarkerName, quoteHtml, round } from "facilmap-utils";
import type { PadId, ID } from "facilmap-types";
import Database from "../database/database.js";
import { ReadableStream } from "stream/web";
import { getI18n } from "../i18n.js";

export type TabularData = {
	fields: string[];
	objects: ReadableStream<string[]>;
};

export async function getTabularData(
	database: Database,
	padId: PadId,
	typeId: ID,
	html: boolean,
	filter?: string,
	hide: string[] = []
): Promise<TabularData> {
	const padData = await database.pads.getPadData(padId);
	if (!padData)
		throw new Error(getI18n().t("pad-not-found-error", { padId }));

	const type = await database.types.getType(padData.id, typeId);

	const filterFunc = compileExpression(filter);

	const handlePlainText = (str: string) => html ? quoteHtml(str) : str;

	const fields = [
		"Name",
		...(type.type === "marker" ? [
			"Position"
		] : type.type === "line" ? [
			"Distance",
			"Time"
		] : []),
		...type.fields.map((f) => f.name)
	];

	const objects = type.type === "marker" ? flatMapStream(asyncIteratorToStream(database.markers.getPadMarkersByType(padId, typeId)), (marker): Array<Array<() => string>> => {
		if (!filterFunc(marker, type)) {
			return [];
		}

		return [[
			() => handlePlainText(normalizeMarkerName(marker.name)),
			() => handlePlainText(`${round(marker.lat, 5)},${round(marker.lon, 5)}`),
			...type.fields.map((f) => () => formatField(f, marker.data[f.name], html).trim())
		]];
	}) : flatMapStream(asyncIteratorToStream(database.lines.getPadLinesByType(padId, typeId)), (line): Array<Array<() => string>> => {
		if (!filterFunc(line, type)) {
			return [];
		}

		return [[
			() => handlePlainText(normalizeLineName(line.name)),
			() => handlePlainText(formatDistance(line.distance)),
			() => handlePlainText(line.time != null ? formatRouteTime(line.time, line.mode) : ""),
			...type.fields.map((f) => () => formatField(f, line.data[f.name], html).trim())
		]];
	});

	return {
		fields: fields.filter((f) => !hide.includes(f)),
		objects: mapStream(objects, (obj) => obj.flatMap((v, idx) => hide.includes(fields[idx]) ? [] : [v()]))
	};
}
