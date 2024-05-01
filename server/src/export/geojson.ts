import { asyncIteratorToArray, streamPromiseToStream, jsonStreamArray, mapAsyncIterator, jsonStreamRecord, type JsonStream, concatAsyncIterators, flatMapAsyncIterator } from "../utils/streams.js";
import { compileExpression } from "facilmap-utils";
import type { Marker, MarkerFeature, MapId, TrackPoint, Line } from "facilmap-types";
import Database from "../database/database.js";
import { cloneDeep, keyBy, mapValues, omit } from "lodash-es";
import type { ReadableStream } from "stream/web";
import { getI18n } from "../i18n.js";

export function exportGeoJson(database: Database, mapId: MapId, filter?: string): ReadableStream<string> {
	return streamPromiseToStream((async () => {
		const mapData = await database.maps.getMapData(mapId);

		if (!mapData)
			throw new Error(getI18n().t("map-not-found-error", { mapId }));

		const filterFunc = compileExpression(filter);

		const types = keyBy(await asyncIteratorToArray(database.types.getTypes(mapId)), "id");

		return jsonStreamRecord({
			type: "FeatureCollection",
			...(mapData.defaultView ? {
				bbox: [mapData.defaultView.left, mapData.defaultView.bottom, mapData.defaultView.right, mapData.defaultView.top]
			} : { }),
			facilmap: jsonStreamRecord({
				name: mapData.name,
				searchEngines: mapData.searchEngines,
				description: mapData.description,
				clusterMarkers: mapData.clusterMarkers,
				views: jsonStreamArray(mapAsyncIterator(database.views.getViews(mapId), (view) => omit(view, ["id", "mapId"])))
			}),
			types: mapValues(types, (type) => omit(type, ["id", "mapId"])),
			features: jsonStreamArray(concatAsyncIterators(
				() => flatMapAsyncIterator(database.markers.getMapMarkers(mapId), (marker) => {
					if (filterFunc(marker, types[marker.typeId])) {
						return [markerToGeoJson(marker)];
					} else {
						return [];
					}
				}),
				() => flatMapAsyncIterator(database.lines.getMapLines(mapId), (line) => {
					if (filterFunc(line, types[line.typeId])) {
						return [lineToGeoJson(line, database.lines.getLinePointsForLine(line.id))];
					} else {
						return [];
					}
				})
			))
		});
	})());
}

function markerToGeoJson(marker: Marker): JsonStream {
	return jsonStreamRecord({
		type: "Feature",
		geometry: {
			type: "Point",
			coordinates: [marker.lon, marker.lat]
		},
		properties: {
			name: marker.name,
			colour: marker.colour,
			size: marker.size,
			icon: marker.icon,
			shape: marker.shape,
			data: cloneDeep(marker.data),
			typeId: marker.typeId
		}
	} satisfies MarkerFeature);
}

function lineToGeoJson(line: Line, trackPoints: AsyncIterable<TrackPoint>): ReadableStream<string> {
	return jsonStreamRecord({
		type: "Feature",
		geometry: jsonStreamRecord({
			type: "LineString",
			coordinates: jsonStreamArray(mapAsyncIterator(trackPoints, (trackPoint) => [trackPoint.lon, trackPoint.lat]))
		}),
		properties: {
			name: line.name,
			mode: line.mode,
			colour: line.colour,
			width: line.width,
			stroke: line.stroke,
			distance: line.distance,
			time: line.time,
			data: line.data,
			routePoints: line.routePoints,
			typeId: line.typeId
		}
	});
}