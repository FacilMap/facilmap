import { flatMapStream, iterableToStream, mapStream } from "../utils/streams.js";
import { compileExpression, formatDistance, formatFieldName, formatFieldValue, formatRouteTime, normalizeLineName, normalizeMarkerName, quoteHtml, round } from "facilmap-utils";
import type { ID } from "facilmap-types";
import Database from "../database/database.js";
import { getI18n } from "../i18n.js";

export type TabularData = {
	fields: string[];
	fieldNames: string[];
	objects: ReadableStream<string[]>;
};

export async function getTabularData(
	database: Database,
	mapId: ID,
	typeId: ID,
	html: boolean,
	filter?: string,
	hide: string[] = []
): Promise<TabularData> {
	const i18n = getI18n();

	const mapData = await database.maps.getMapData(mapId);
	if (!mapData)
		throw new Error(i18n.t("map-not-found-error", { mapId }));

	const type = await database.types.getType(mapData.id, typeId);

	const filterFunc = compileExpression(filter);

	const handlePlainText = (str: string) => html ? quoteHtml(str) : str;

	const fieldsWithNames = [
		["Name", i18n.t("tabular.field-name")],
		...(type.type === "marker" ? [
			["Position", i18n.t("tabular.field-position")]
		] : type.type === "line" ? [
			["Distance", i18n.t("tabular.field-distance")],
			["Time", i18n.t("tabular.field-time")]
		] : []),
		...type.fields.map((f) => [f.name, formatFieldName(f.name)])
	];

	const objects = type.type === "marker" ? flatMapStream(iterableToStream(database.markers.getMapMarkersByType(mapId, typeId)), (marker): Array<Array<() => string>> => {
		if (!filterFunc(marker, type)) {
			return [];
		}

		return [[
			() => handlePlainText(normalizeMarkerName(marker.name)),
			() => handlePlainText(`${round(marker.lat, 5)},${round(marker.lon, 5)}`),
			...type.fields.map((f) => () => formatFieldValue(f, marker.data[f.name], html).trim())
		]];
	}) : flatMapStream(iterableToStream(database.lines.getMapLinesByType(mapId, typeId)), (line): Array<Array<() => string>> => {
		if (!filterFunc(line, type)) {
			return [];
		}

		return [[
			() => handlePlainText(normalizeLineName(line.name)),
			() => handlePlainText(formatDistance(line.distance)),
			() => handlePlainText(line.time != null ? formatRouteTime(line.time, line.mode) : ""),
			...type.fields.map((f) => () => formatFieldValue(f, line.data[f.name], html).trim())
		]];
	});

	return {
		fields: fieldsWithNames.filter((f) => !hide.includes(f[0])).map((f) => f[0]),
		fieldNames: fieldsWithNames.filter((f) => !hide.includes(f[0])).map((f) => f[1]),
		objects: mapStream(objects, (obj) => obj.flatMap((v, idx) => hide.includes(fieldsWithNames[idx][0]) ? [] : [v()]))
	};
}
