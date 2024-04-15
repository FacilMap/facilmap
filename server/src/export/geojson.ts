import { asyncIteratorToArray, streamPromiseToStream, jsonStreamArray, mapAsyncIterator, jsonStreamRecord, type JsonStream, concatAsyncIterators, flatMapAsyncIterator } from "../utils/streams.js";
import { compileExpression } from "facilmap-utils";
import type { Marker, MarkerFeature, PadId, TrackPoint, Line } from "facilmap-types";
import Database from "../database/database.js";
import { cloneDeep, keyBy, mapValues, omit } from "lodash-es";
import type { ReadableStream } from "stream/web";
import { getI18n } from "../i18n.js";

export function exportGeoJson(database: Database, padId: PadId, filter?: string): ReadableStream<string> {
	return streamPromiseToStream((async () => {
		const padData = await database.pads.getPadData(padId);

		if (!padData)
			throw new Error(getI18n().t("pad-not-found-error", { padId }));

		const filterFunc = compileExpression(filter);

		const types = keyBy(await asyncIteratorToArray(database.types.getTypes(padId)), "id");

		return jsonStreamRecord({
			type: "FeatureCollection",
			...(padData.defaultView ? {
				bbox: [padData.defaultView.left, padData.defaultView.bottom, padData.defaultView.right, padData.defaultView.top]
			} : { }),
			facilmap: jsonStreamRecord({
				name: padData.name,
				searchEngines: padData.searchEngines,
				description: padData.description,
				clusterMarkers: padData.clusterMarkers,
				views: jsonStreamArray(mapAsyncIterator(database.views.getViews(padId), (view) => omit(view, ["id", "padId"])))
			}),
			types: mapValues(types, (type) => omit(type, ["id", "padId"])),
			features: jsonStreamArray(concatAsyncIterators(
				flatMapAsyncIterator(database.markers.getPadMarkers(padId), (marker) => {
					if (filterFunc(marker, types[marker.typeId])) {
						return [markerToGeoJson(marker)];
					} else {
						return [];
					}
				}),
				flatMapAsyncIterator(database.lines.getPadLines(padId), (line) => {
					if (filterFunc(line, types[line.typeId])) {
						return [lineToGeoJson(line, database.lines.getAllLinePoints(line.id))];
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