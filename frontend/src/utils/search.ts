import { FindOnMapResult, SearchResult } from "facilmap-types";
import { FileResult } from "./files";

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