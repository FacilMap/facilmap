import { iterableToArray, streamPromiseToStream, mapAsyncIterable, concatAsyncIterables, flatMapAsyncIterable } from "../utils/streams.js";
import { compileExpression } from "facilmap-utils";
import type { Marker, MarkerFeature, TrackPoint, Line, InterfaceToType, LineFeature, ReplaceProperties, ID } from "facilmap-types";
import Database from "../database/database.js";
import { cloneDeep, keyBy, mapValues, omit, pick } from "lodash-es";
import { getI18n } from "../i18n.js";
import { JsonStringifier, arrayStream, serializeJsonValue, type ArrayStream } from "json-stream-es";

export function exportGeoJson(database: Database, mapId: ID, filter?: string): ReadableStream<string> {
	return streamPromiseToStream((async () => {
		const mapData = await database.maps.getMapData(mapId);

		if (!mapData)
			throw new Error(getI18n().t("map-not-found-error", { mapId }));

		const filterFunc = compileExpression(filter);

		const types = keyBy(await iterableToArray(database.types.getTypes(mapId)), "id");

		return serializeJsonValue({
			type: "FeatureCollection",
			...(mapData.defaultView ? {
				bbox: [mapData.defaultView.left, mapData.defaultView.bottom, mapData.defaultView.right, mapData.defaultView.top]
			} : { }),
			facilmap: {
				name: mapData.name,
				searchEngines: mapData.searchEngines,
				description: mapData.description,
				clusterMarkers: mapData.clusterMarkers,
				views: () => arrayStream(mapAsyncIterable(database.views.getViews(mapId), (view) => omit(view, ["id", "mapId"]))),
				types: mapValues(types, (type) => omit(type, ["id", "mapId"]))
			},
			features: () => arrayStream(concatAsyncIterables<InterfaceToType<MarkerFeature> | StreamedLineFeature>(
				() => flatMapAsyncIterable(database.markers.getMapMarkers(mapId), (marker) => {
					if (filterFunc(marker, types[marker.typeId])) {
						return [markerToGeoJson(marker)];
					} else {
						return [];
					}
				}),
				() => flatMapAsyncIterable(database.lines.getMapLines(mapId), (line) => {
					if (filterFunc(line, types[line.typeId])) {
						return [lineToGeoJson(line, database.lines.getLinePointsForLine(line.id))];
					} else {
						return [];
					}
				})
			))
		}).pipeThrough(new JsonStringifier());
	})());
}

function markerToGeoJson(marker: Marker): InterfaceToType<MarkerFeature> {
	return {
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
	};
}

const lineProps = ["name", "mode", "colour", "width", "stroke", "distance", "time", "data", "routePoints", "typeId"] as const;
type LineProp = typeof lineProps[number];
type StreamedLineFeature<L extends Partial<Line> = Line> = ReplaceProperties<LineFeature, {
	properties: Pick<LineFeature["properties"], keyof L & LineProp>;
	geometry: ReplaceProperties<LineFeature["geometry"], {
		coordinates: ArrayStream<LineFeature["geometry"]["coordinates"][0]>;
	}>;
}>;

function lineToGeoJson<L extends Partial<Line>>(line: L, trackPoints: AsyncIterable<TrackPoint>): StreamedLineFeature<L> {
	return {
		type: "Feature",
		geometry: {
			type: "LineString",
			coordinates: arrayStream(mapAsyncIterable(trackPoints, (trackPoint) => [trackPoint.lon, trackPoint.lat]))
		},
		properties: pick(line, lineProps) as Pick<LineFeature["properties"], keyof L & LineProp>
	};
}

export function exportLineToGeoJson(line: Partial<Line>, trackPoints: AsyncIterable<TrackPoint>): ReadableStream<string> {
	return serializeJsonValue(lineToGeoJson(line, trackPoints)).pipeThrough(new JsonStringifier());
}