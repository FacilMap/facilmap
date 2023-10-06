import { jsonStream, asyncIteratorToArray } from "../utils/streams.js";
import { compileExpression } from "facilmap-utils";
import { Marker, MarkerFeature, LineFeature, PadId } from "facilmap-types";
import Database from "../database/database.js";
import { clone, keyBy, mapValues, omit } from "lodash-es";
import { LineWithTrackPoints } from "../database/line.js";

export async function* exportGeoJson(database: Database, padId: PadId, filter?: string): AsyncGenerator<string, void, void> {
	const padData = await database.pads.getPadData(padId);

	if (!padData)
		throw new Error(`Pad ${padId} could not be found.`);

	const filterFunc = compileExpression(filter);

	const types = keyBy(await asyncIteratorToArray(database.types.getTypes(padId)), "id");

	const result = jsonStream({
		type: "FeatureCollection",
		...(padData.defaultView ? { bbox: "%bbox%" } : { }),
		facilmap: {
			name: "%name%",
			searchEngines: "%searchEngines%",
			description: "%description%",
			clusterMarkers: "%clusterMarkers",
			views: "%views%",
			types: "%types%"
		},
		features: "%features%"
	}, {
		bbox: padData.defaultView && [padData.defaultView.left, padData.defaultView.bottom, padData.defaultView.right, padData.defaultView.top],
		name: padData.name,
		searchEngines: padData.searchEngines,
		description: padData.description,
		clusterMarkers: padData.clusterMarkers,
		views: async function*() {
			for await (const view of database.views.getViews(padId)) {
				yield omit(view, ["id", "padId"]);
			}
		},
		types: mapValues(types, (type) => omit(type, ["id", "padId"])),
		features: async function*() {
			for await (const marker of database.markers.getPadMarkers(padId)) {
				if (filterFunc(marker, types[marker.typeId])) {
					yield markerToGeoJson(marker);
				}
			}

			for await (const line of database.lines.getPadLinesWithPoints(padId)) {
				if (filterFunc(line, types[line.typeId])) {
					yield lineToGeoJson(line);
				}
			}
		}
	});

	for await (const chunk of result) {
		yield chunk;
	}
}

function markerToGeoJson(marker: Marker): MarkerFeature {
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
			symbol: marker.symbol,
			shape: marker.shape,
			data: clone(marker.data),
			typeId: marker.typeId
		}
	};
}

function lineToGeoJson(line: LineWithTrackPoints): LineFeature {
	return {
		type: "Feature",
		geometry: {
			type: "LineString",
			coordinates: line.trackPoints.map((trackPoint) => [trackPoint.lon, trackPoint.lat])
		},
		properties: {
			name: line.name,
			mode: line.mode,
			colour: line.colour,
			width: line.width,
			distance: line.distance,
			time: line.time,
			data: line.data,
			routePoints: line.routePoints,
			typeId: line.typeId
		}
	};
}