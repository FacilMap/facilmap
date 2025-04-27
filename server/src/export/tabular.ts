import { flatMapStream, iterableToStream, mapStream } from "../utils/streams.js";
import { compileExpression, formatDistance, formatFieldName, formatFieldValue, formatRouteTime, normalizeLineName, normalizeMarkerName, quoteHtml, round } from "facilmap-utils";
import type { ID } from "facilmap-types";
import { getI18n } from "../i18n.js";
import type { RawActiveMapLink } from "../utils/permissions.js";
import type { ApiV3Backend } from "../api/api-v3.js";

export type TabularData = {
	fields: string[];
	fieldNames: string[];
	objects: ReadableStream<string[]>;
};

export async function getTabularData(
	api: ApiV3Backend,
	mapLink: RawActiveMapLink,
	typeId: ID,
	html: boolean,
	filter?: string,
	hide: string[] = []
): Promise<TabularData> {
	const i18n = getI18n();

	const type = await api.getType(mapLink, typeId);

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

	const objects = type.type === "marker" ? flatMapStream(iterableToStream((await api.getMapMarkers(mapLink, { typeId })).results), (marker): Array<Array<() => string>> => {
		if (!filterFunc(marker, type)) {
			return [];
		}

		return [[
			() => handlePlainText(normalizeMarkerName(marker.name)),
			() => handlePlainText(`${round(marker.lat, 5)},${round(marker.lon, 5)}`),
			...type.fields.map((f) => () => formatFieldValue(f, marker.data[f.id], html).trim())
		]];
	}) : flatMapStream(iterableToStream((await api.getMapLines(mapLink, { typeId })).results), (line): Array<Array<() => string>> => {
		if (!filterFunc(line, type)) {
			return [];
		}

		return [[
			() => handlePlainText(normalizeLineName(line.name)),
			() => handlePlainText(formatDistance(line.distance)),
			() => handlePlainText(line.time != null ? formatRouteTime(line.time, line.mode) : ""),
			...type.fields.map((f) => () => formatFieldValue(f, line.data[f.id], html).trim())
		]];
	});

	return {
		fields: fieldsWithNames.filter((f) => !hide.includes(f[0])).map((f) => f[0]),
		fieldNames: fieldsWithNames.filter((f) => !hide.includes(f[0])).map((f) => f[1]),
		objects: mapStream(objects, (obj) => obj.flatMap((v, idx) => hide.includes(fieldsWithNames[idx][0]) ? [] : [v()]))
	};
}
