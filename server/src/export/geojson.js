import { streamEachPromise } from "../utils/streams";
import { promiseAuto } from "../utils/utils";

const commonFilter = require("facilmap-frontend/common/filter");

const geojson = module.exports = {
	exportGeoJson(database, padId, filter) {
		let ret = {
			type: "FeatureCollection",
			features: [],
			facilmap: {}
		};

		const filterFunc = commonFilter.compileExpression(filter);

		return promiseAuto({
			padData: database.getPadData(padId).then(padData => {
				if(padData.defaultView)
					ret.bbox = [padData.defaultView.left, padData.defaultView.bottom, padData.defaultView.right, padData.defaultView.top];

				Object.assign(ret.facilmap, {
					name: padData.name,
					searchEngines: padData.searchEngines,
					description: padData.description,
					clusterMarkers: padData.clusterMarkers
				});
			}),

			views: () => {
				ret.facilmap.views = [];
				return streamEachPromise(database.getViews(padId), (view) => {
					view = JSON.parse(JSON.stringify(view));
					delete view.id;
					delete view.padId;

					ret.facilmap.views.push(view);
				});
			},

			types: () => {
				const types = {};
				ret.facilmap.types = {};
				return streamEachPromise(database.getTypes(padId), function(type) {
					types[type.id] = type; // To use in filterFunc

					let typeId = type.id;
					type = JSON.parse(JSON.stringify(type));
					delete type.id;
					delete type.padId;

					ret.facilmap.types[typeId] = type;
				}).then(() => (types));
			},

			markers: (types) => {
				return streamEachPromise(database.getPadMarkers(padId), function(marker) {
					if(filterFunc(commonFilter.prepareObject(marker, types[marker.typeId]))) {
						ret.features.push({
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
								data: JSON.parse(JSON.stringify(marker.data)),
								typeId: marker.typeId
							}
						});
					}
				});
			},

			lines: (types) => {
				return streamEachPromise(database.getPadLinesWithPoints(padId), function(line) {
					if(filterFunc(commonFilter.prepareObject(line, types[line.typeId]))) {
						ret.features.push({
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
						});
					}
				});
			}
		}).then(() => ret);
	}
};
