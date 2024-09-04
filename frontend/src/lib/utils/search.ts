import type { FindOnMapResult, SearchResult } from "facilmap-types";
import { numberKeys } from "facilmap-utils";
import { isEqual } from "lodash-es";
import type { FileResult, FileResultObject } from "./files";
import type { ClientSub } from "../components/facil-map-context-provider/facil-map-context-provider.vue";

const VIEW_KEYS: Array<keyof FileResultObject["views"][0]> = ["name", "baseLayer", "layers", "top", "bottom", "left", "right", "filter"];
const TYPE_KEYS: Array<keyof FileResultObject["types"][0]> = ["name", "type", "defaultColour", "colourFixed", "defaultSize", "sizeFixed", "defaultIcon", "iconFixed", "defaultShape", "shapeFixed", "defaultWidth", "widthFixed", "defaultStroke", "strokeFixed", "defaultMode", "modeFixed", "fields"];

export function isSearchResult(result: SearchResult | FindOnMapResult | FileResult): result is SearchResult {
	return !isMapResult(result) && !isFileResult(result);
}

export function isMapResult(result: SearchResult | FindOnMapResult | FileResult): result is FindOnMapResult {
	return "kind" in result;
}

export function isFileResult(result: SearchResult | FindOnMapResult | FileResult): result is FileResult {
	return "isFileResult" in result && result.isFileResult;
}

export function isMarkerResult(result: SearchResult | FindOnMapResult | FileResult): boolean {
	if (isMapResult(result))
		return result.kind == "marker";
	else
		return (result.lat != null && result.lon != null) || (!!result.geojson && result.geojson.type == "Point");
}

export function isLineResult(result: SearchResult | FindOnMapResult | FileResult): boolean {
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

export function typeExists(clientSub: ClientSub, type: FileResultObject["types"][0]): boolean {
	for (const typeId of numberKeys(clientSub.data.types)) {
		if(!TYPE_KEYS.some((idx) => !isEqual(type[idx], clientSub.data.types[typeId][idx])))
			return true;
	}
	return false;
}
