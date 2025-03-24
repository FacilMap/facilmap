import type { FindOnMapResult, MapSlug, SearchResult } from "facilmap-types";
import { numberKeys } from "facilmap-utils";
import { isEqual } from "lodash-es";
import type { FileResult, FileResultObject } from "./files";
import type { ClientSub } from "../components/facil-map-context-provider/facil-map-context-provider.vue";
import type { DeepReadonly } from "vue";
import type { MapStorage } from "facilmap-client";

const VIEW_KEYS: Array<keyof FileResultObject["views"][0]> = ["name", "baseLayer", "layers", "top", "bottom", "left", "right", "filter"];
const TYPE_KEYS: Array<keyof FileResultObject["types"][0]> = ["name", "type", "defaultColour", "colourFixed", "defaultSize", "sizeFixed", "defaultIcon", "iconFixed", "defaultShape", "shapeFixed", "defaultWidth", "widthFixed", "defaultStroke", "strokeFixed", "defaultMode", "modeFixed", "fields"];

export type MapResult = FindOnMapResult & { mapSlug: MapSlug };

export function isSearchResult(result: DeepReadonly<SearchResult> | DeepReadonly<MapResult> | DeepReadonly<FileResult>): result is DeepReadonly<SearchResult> {
	return !isMapResult(result) && !isFileResult(result);
}

export function isMapResult(result: DeepReadonly<SearchResult> | DeepReadonly<MapResult> | DeepReadonly<FileResult>): result is DeepReadonly<MapResult> {
	return "kind" in result;
}

export function isFileResult(result: DeepReadonly<SearchResult> | DeepReadonly<MapResult> | DeepReadonly<FileResult>): result is DeepReadonly<FileResult> {
	return "isFileResult" in result && result.isFileResult;
}

export function isMarkerResult(result: DeepReadonly<SearchResult | MapResult | FileResult>): boolean {
	if (isMapResult(result))
		return result.kind == "marker";
	else
		return (result.lat != null && result.lon != null) || (!!result.geojson && result.geojson.type == "Point");
}

export function isLineResult(result: DeepReadonly<SearchResult | MapResult | FileResult>): boolean {
	if (isMapResult(result))
		return result.kind == "line";
	else
		return !!result.geojson && ["LineString", "MultiLineString", "Polygon", "MultiPolygon"].includes(result.geojson.type);
}

export function viewExists(clientSub: ClientSub, view: FileResultObject["views"][0]): boolean {
	for (const viewId of numberKeys(clientSub.data.views)) {
		if(!VIEW_KEYS.some((idx) => !isEqual(view[idx], clientSub.data.views[viewId][idx])))
			return true;
	}
	return false;
}

export function typeExists(mapStorage: MapStorage, type: FileResultObject["types"][0]): boolean {
	for (const typeId of numberKeys(mapStorage.types)) {
		if(!TYPE_KEYS.some((idx) => !isEqual(type[idx], mapStorage.types[typeId][idx])))
			return true;
	}
	return false;
}
