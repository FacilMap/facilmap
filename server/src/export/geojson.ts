import { jsonStream, streamToArrayPromise, toStream } from "../utils/streams";
import { clone } from "../utils/utils";
import { compileExpression, prepareObject } from "facilmap-frontend/common/filter";
import { Marker, PadId } from "../../../types/src";
import Database from "../database/database";
import { keyBy, omit } from "lodash";
import { LineWithTrackPoints } from "../database/line";
import { mapValues } from "async";

export function exportGeoJson(database: Database, padId: PadId, filter?: string): Highland.Stream<string> {
	return toStream(async () => {
		const padData = await database.pads.getPadData(padId);

		if (!padData)
			throw new Error(`Pad ${padId} could not be found.`);

		const filterFunc = compileExpression(filter);

		const views = database.views.getViews(padId)
			.map((view) => omit(view, ["id", "padId"]));

		const types = keyBy(await streamToArrayPromise(database.types.getTypes(padId)), "id");

		const markers = database.markers.getPadMarkers(padId)
			.filter((marker) => filterFunc(prepareObject(marker, types[marker.typeId])))
			.map(markerToGeoJson);

		const lines = database.lines.getPadLinesWithPoints(padId)
			.filter((line) => filterFunc(prepareObject(line, types[line.typeId])))
			.map(lineToGeoJson);

		return jsonStream({
			type: "FeatureCollection",
			...(padData.defaultView ? { bbox: "%bbox" } : { }),
			facilmap: {
				name: "%name%",
				searchEngines: "%searchEngines%",
				description: "%description%",
				clusterMarkers: "%clusterMarkers",
				views: "%views%",
				types: "%types%"
			},
			features: "%features"
		}, {
			bbox: padData.defaultView && [padData.defaultView.left, padData.defaultView.bottom, padData.defaultView.right, padData.defaultView.top],
			name: padData.name,
			searchEngines: padData.searchEngines,
			description: padData.description,
			clusterMarkers: padData.clusterMarkers,
			views,
			types: mapValues(types, (type) => omit(type, ["id", "padId"])),
			features: markers.concat(lines)
		});
	}).flatten();
}

function markerToGeoJson(marker: Marker): GeoJSON.Feature {
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

function lineToGeoJson(line: LineWithTrackPoints): GeoJSON.Feature {
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