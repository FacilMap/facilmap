import { iterableToArray, streamPromiseToStream, mapAsyncIterable, concatAsyncIterables, flatMapAsyncIterable, StringAggregationTransformStream } from "../utils/streams.js";
import { compileExpression } from "facilmap-utils";
import { type Marker, type MarkerFeature, type TrackPoint, type Line, type InterfaceToType, type LineFeature, type ReplaceProperties, dataByFieldIdToDataByName, type Type, type Stripped } from "facilmap-types";
import { keyBy, mapValues, omit, pick } from "lodash-es";
import { JsonStringifier, arrayStream, serializeJsonValue, type ArrayStream } from "json-stream-es";
import type { RawMapLink } from "../utils/permissions.js";
import type { ApiV3Backend } from "../api/api-v3.js";

export function exportGeoJson(api: ApiV3Backend, mapLink: RawMapLink, filter?: string): ReadableStream<string> {
	return streamPromiseToStream((async () => {
		const mapData = await api.getMap(mapLink);

		const filterFunc = compileExpression(filter);

		const types = keyBy(await iterableToArray((await api.getMapTypes(mapLink)).results), "id");

		return serializeJsonValue({
			type: "FeatureCollection",
			...(mapData.defaultView ? {
				bbox: [mapData.defaultView.left, mapData.defaultView.bottom, mapData.defaultView.right, mapData.defaultView.top]
			} : { }),
			facilmap: {
				name: mapData.name,
				description: mapData.description,
				clusterMarkers: mapData.clusterMarkers,
				views: async () => arrayStream(mapAsyncIterable((await api.getMapViews(mapLink)).results, (view) => omit(view, ["id", "mapId"]))),
				types: mapValues(types, (type) => omit(type, ["id", "mapId"]))
			},
			features: () => arrayStream(concatAsyncIterables<InterfaceToType<MarkerFeature> | StreamedLineFeature>(
				async () => flatMapAsyncIterable((await api.getMapMarkers(mapLink)).results, (marker) => {
					if (filterFunc(marker, types[marker.typeId])) {
						return [markerToGeoJson(marker, types[marker.typeId])];
					} else {
						return [];
					}
				}),
				async () => flatMapAsyncIterable((await api.getMapLines(mapLink)).results, async (line) => {
					if (filterFunc(line, types[line.typeId])) {
						return [lineToGeoJson(line, types[line.typeId], (await api.getLinePoints(mapLink, line.id)).results)];
					} else {
						return [];
					}
				})
			))
		}).pipeThrough(new JsonStringifier()).pipeThrough(new StringAggregationTransformStream());
	})());
}

function markerToGeoJson(marker: Marker, type: Stripped<Type>): InterfaceToType<MarkerFeature> {
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
			data: dataByFieldIdToDataByName(marker.data, type),
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

function lineToGeoJson<L extends Partial<Line>>(line: L, type: Stripped<Type> | undefined, trackPoints: AsyncIterable<TrackPoint>): StreamedLineFeature<L> {
	return {
		type: "Feature",
		geometry: {
			type: "LineString",
			coordinates: arrayStream(mapAsyncIterable(trackPoints, (trackPoint) => [trackPoint.lon, trackPoint.lat]))
		},
		properties: {
			...pick(line, lineProps) as Pick<LineFeature["properties"], keyof L & LineProp>,
			...line.data && type ? { data: dataByFieldIdToDataByName(line.data, type) } : {}
		}
	};
}

export function exportLineToGeoJson(line: Partial<Line>, type: Stripped<Type> | undefined, trackPoints: AsyncIterable<TrackPoint>): ReadableStream<string> {
	return serializeJsonValue(lineToGeoJson(line, type, trackPoints)).pipeThrough(new JsonStringifier()).pipeThrough(new StringAggregationTransformStream());
}