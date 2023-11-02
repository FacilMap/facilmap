import type { CRU, Line, Marker, Point, SearchResult, Type } from "facilmap-types";
import type { LineString, MultiLineString, MultiPolygon, Polygon, Position } from "geojson";
import type { FileResult } from "../../utils/files";
import type { SelectedItem } from "../../utils/selection";
import type { Client } from "../client-context.vue";

/**
 * Prefills the fields of a type with information from a search result. The "address" and "extratags" from
 * the search result are taken matched whose names equal the tag key (ignoring case and non-letters). The
 * returned object is an object that can be used as "data" for a marker and line, so an object that maps
 * field names to values.
 */
export function mapSearchResultToType(result: SearchResult, type: Type): Record<string, string> {
	return mapTagsToType({
		...(result.address ? { address: result.address } : {}),
		...result.extratags
	}, type);
}

export function mapTagsToType(tags: Record<string, string>, type: Type): Record<string, string> {
	let keyMap = (keys: string[]) => {
		let ret: Record<string, string> = Object.create(null);
		for(let key of keys)
			ret[key.replace(/[^a-z0-9]/gi, "").toLowerCase()] = key;
		return ret;
	};

	let fieldKeys = keyMap(type.fields.map((field) => (field.name)));
	let resultDataKeys = keyMap(Object.keys(tags));

	const ret: Record<string, string> = Object.create(null);
	for(let key in resultDataKeys) {
		if(fieldKeys[key])
			ret[fieldKeys[key]] = tags[resultDataKeys[key]];
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

export async function addSearchResultsToMap(data: Array<{ result: SearchResult | FileResult; type: Type }>, client: Client): Promise<SelectedItem[]> {
	const selection: SelectedItem[] = [];

	for (const { result, type } of data) {
		const obj: Partial<Marker<CRU.CREATE> & Line<CRU.CREATE>> = {
			name: result.short_name
		};

		if("fmProperties" in result && result.fmProperties) { // Import GeoJSON
			Object.assign(obj, result.fmProperties);
			delete obj.typeId;
		} else {
			obj.data = mapSearchResultToType(result, type)
		}

		if(type.type == "marker") {
			const marker = await client.addMarker({
				...obj,
				lat: result.lat ?? (result.geojson as Point).coordinates[1],
				lon: result.lon ?? (result.geojson as Point).coordinates[0],
				typeId: type.id
			});

			selection.push({ type: "marker", id: marker.id });
		} else if(type.type == "line") {
			if (obj.routePoints) {
				const line = await client.addLine({
					...obj,
					routePoints: obj.routePoints,
					typeId: type.id
				});

				selection.push({ type: "line", id: line.id });
			} else {
				const trackPoints = lineStringToTrackPoints(result.geojson as any);
				const line = await client.addLine({
					...obj,
					typeId: type.id,
					routePoints: [trackPoints[0], trackPoints[trackPoints.length-1]],
					trackPoints: trackPoints,
					mode: "track"
				});

				selection.push({ type: "line", id: line.id });
			}
		}
	}

	return selection;
}