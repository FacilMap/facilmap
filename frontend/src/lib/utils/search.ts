import type { FindOnMapResult, SearchResult } from "facilmap-types";
import { numberKeys } from "facilmap-utils";
import { isEqual } from "lodash-es";
import type { FileResult, FileResultObject } from "./files";
import type { ClientContext } from "../components/facil-map-context-provider/client-context";
import type { DeepReadonly } from "vue";

const VIEW_KEYS: Array<keyof FileResultObject["views"][0]> = ["name", "baseLayer", "layers", "top", "bottom", "left", "right", "filter"];
const TYPE_KEYS: Array<keyof FileResultObject["types"][0]> = ["name", "type", "defaultColour", "colourFixed", "defaultSize", "sizeFixed", "defaultIcon", "iconFixed", "defaultShape", "shapeFixed", "defaultWidth", "widthFixed", "defaultStroke", "strokeFixed", "defaultMode", "modeFixed", "fields"];

export function isSearchResult(result: DeepReadonly<SearchResult> | DeepReadonly<FindOnMapResult> | DeepReadonly<FileResult>): result is DeepReadonly<SearchResult> {
	return !isMapResult(result) && !isFileResult(result);
}

export function isMapResult(result: DeepReadonly<SearchResult> | DeepReadonly<FindOnMapResult> | DeepReadonly<FileResult>): result is DeepReadonly<FindOnMapResult> {
	return "kind" in result;
}

export function isFileResult(result: DeepReadonly<SearchResult> | DeepReadonly<FindOnMapResult> | DeepReadonly<FileResult>): result is DeepReadonly<FileResult> {
	return "isFileResult" in result && result.isFileResult;
}

export function isMarkerResult(result: DeepReadonly<SearchResult | FindOnMapResult | FileResult>): boolean {
	if (isMapResult(result))
		return result.kind == "marker";
	else
		return (result.lat != null && result.lon != null) || (!!result.geojson && result.geojson.type == "Point");
}

export function isLineResult(result: DeepReadonly<SearchResult | FindOnMapResult | FileResult>): boolean {
	if (isMapResult(result))
		return result.kind == "line";
	else
		return !!result.geojson && ["LineString", "MultiLineString", "Polygon", "MultiPolygon"].includes(result.geojson.type);
}

export function viewExists(client: ClientContext, view: FileResultObject["views"][0]): boolean {
	for (const viewId of numberKeys(client.views)) {
		if(!VIEW_KEYS.some((idx) => !isEqual(view[idx], client.views[viewId][idx])))
			return true;
	}
	return false;
}

export function typeExists(client: ClientContext, type: FileResultObject["types"][0]): boolean {
	for (const typeId of numberKeys(client.types)) {
		if(!TYPE_KEYS.some((idx) => !isEqual(type[idx], client.types[typeId][idx])))
			return true;
	}
	return false;
}
