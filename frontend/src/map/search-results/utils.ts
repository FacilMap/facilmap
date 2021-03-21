import { Point, SearchResult, Type } from "facilmap-types";
import { LineString, MultiLineString, MultiPolygon, Polygon, Position } from "geojson";

/**
 * Prefills the fields of a type with information from a search result. The "address" and "extratags" from
 * the search result are taken matched whose names equal the tag key (ignoring case and non-letters). The
 * returned object is an object that can be used as "data" for a marker and line, so an object that maps
 * field names to values.
 */
export function mapSearchResultToType(result: SearchResult, type: Type): Record<string, string> {
	let keyMap = (keys: string[]) => {
		let ret: Record<string, string> = {};
		for(let key of keys)
			ret[key.replace(/[^a-z0-9]/gi, "").toLowerCase()] = key;
		return ret;
	};

	let resultData = Object.assign({
		address: result.address
	}, result.extratags);

	let fieldKeys = keyMap(type.fields.map((field) => (field.name)));
	let resultDataKeys = keyMap(Object.keys(resultData));

	let ret: Record<string, string> = {};
	for(let key in resultDataKeys) {
		if(fieldKeys[key])
			ret[fieldKeys[key]] = resultData[resultDataKeys[key]];
	}
	return ret;
}

export function lineStringToTrackPoints(geometry: LineString | MultiLineString | Polygon | MultiPolygon): Point[] {
	let coords: Position[][];
	if (geometry.type == "MultiPolygon") // Take only outer ring of polygons
		coords = geometry.coordinates.map((coordArr) => coordArr[0]);
	else if (geometry.type == "MultiLineString")
		coords = geometry.coordinates;
	else if (geometry.type == "Polygon")
		coords = [geometry.coordinates[0]];
	else
		coords = [geometry.coordinates];

	return coords.flat().map((latlng) => ({ lat: latlng[1], lon: latlng[0] }));
}