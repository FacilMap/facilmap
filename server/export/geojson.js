const utils = require("../utils");

const geojson = module.exports = {
	exportGeoJson(database, padId) {
		let ret = {
			type: "FeatureCollection",
			features: [],
			facilmap: {}
		};

		return utils.promiseAuto({
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
				return utils.streamEachPromise(database.getViews(padId), (view) => {
					view = JSON.parse(JSON.stringify(view));
					delete view.id;
					delete view.padId;

					ret.facilmap.views.push(view);
				});
			},

			types: () => {
				ret.facilmap.types = {};
				return utils.streamEachPromise(database.getTypes(padId), function(type) {
					let typeId = type.id;
					type = JSON.parse(JSON.stringify(type));
					delete type.id;
					delete type.padId;

					ret.facilmap.types[typeId] = type;
				});
			},

			markers: () => {
				return utils.streamEachPromise(database.getPadMarkers(padId), function(marker) {
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
				});
			},

			lines: () => {
				return utils.streamEachPromise(database.getPadLinesWithPoints(padId), function(line) {
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
				});
			}
		}).then(() => ret);
	}
};
