const Promise = require("bluebird");
const request = require("request-promise");
const highland = require("highland");

const config = require("../../config");
const utils = require("../utils");

const ROUTING_URL = `https://api.openrouteservice.org/directions?api_key=${config.orsToken}`;

const ROUTING_MODES = {
	"car-": "driving-car",
	"bicycle-": "cycling-regular",
	"bicycle-road": "cycling-road",
	"bicycle-safe": "cycling-safe",
	"bicycle-mountain": "cycling-mountain",
	"bicycle-tour": "cycling-tour",
	"bicycle-electric": "cycling-electric",
	"pedestrian-": "foot-walking",
	"pedestrian-hiking": "foot-hiking",
	"pedestrian-wheelchair": "wheelchair",
};

const MAX_DISTANCE = {
	car: 6000,
	bicycle: 300,
	pedestrian: 200
};

const throttle = highland();
throttle.map((func) => (highland(func()))).parallel(4).done(() => {});

const ors = module.exports = {

	getMaximumDistanceBetweenRoutePoints(mode) {
		return MAX_DISTANCE[mode];
	},

	async calculateRouting(points, mode, routeSettings) {
		return await new Promise((resolve, reject) => {
			throttle.write(() => {
				return this._calculateRouting(points, mode, routeSettings).then(resolve).catch(reject);
			});
		});
	},

	async _calculateRouting(points, mode, routeSettings) {
		let currentGroup = [];
		let coordGroups = [currentGroup];
		for(let point of points) {
			if(utils.calculateDistance(currentGroup.concat([point])) >= MAX_DISTANCE[mode]) {
				if(currentGroup.length == 1)
					throw new Error("Too much distance between route points. Consider adding some via points.");

				coordGroups.push(currentGroup = [currentGroup[currentGroup.length-1]]);

				if(utils.calculateDistance(currentGroup.concat([point])) >= MAX_DISTANCE[mode])
					throw new Error("Too much distance between route points. Consider adding some via points.");
			}

			currentGroup.push(point);
		}

		let results;

		try {
			results = await Promise.all(coordGroups.map((coords) => {
				let url = ROUTING_URL
					+ "&coordinates=" + coords.map((point) => (point.lon + "," + point.lat)).join("|")
					+ "&profile=" + ROUTING_MODES[`${mode}-${routeSettings && routeSettings.type || ""}`]
					+ "&geometry_format=polyline"
					+ "&instructions=false";

				if(routeSettings && routeSettings.details)
					url += "&elevation=true&extra_info=surface|waytype|steepness" + (mode == "car" ? "|tollways" : "");
				if(routeSettings && routeSettings.avoid)
					url += "&options=" + encodeURIComponent(JSON.stringify({"avoid_features": routeSettings.avoid.join("|")}));
				if(routeSettings && routeSettings.preference)
					url += "&preference=" + encodeURIComponent(routeSettings.preference);

				return request.get({
					url: url,
					json: true,
					gzip: true,
					headers: {
						'User-Agent': process.env.fmUserAgent
					}
				});
			}));
		} catch(err) {
			if(err.response.body && err.response.body.error)
				throw new Error(err.response.body.error.message);
			else
				throw err;
		}

		let ret = {
			trackPoints: [],
			distance: 0,
			time: 0,
			ascent: 0,
			descent: 0
		};

		for(let body of results) {
			if(body && body.error) {
				throw new Error(body.error.message);
			}

			if(!body || !body.routes || !body.routes[0])
				throw new Error("Invalid response from routing server.");

			let trackPoints = body.routes[0].geometry.map(function(it) { return { lat: it[1], lon: it[0], ele: it[2] }; });
			if(trackPoints.length > 0 && ret.trackPoints.length > 0 && trackPoints[0].lat == ret.trackPoints[ret.trackPoints.length-1].lat && trackPoints[0].lon == ret.trackPoints[ret.trackPoints.length-1].lon)
				trackPoints.shift();

			ret.trackPoints.push(...trackPoints);
			ret.distance += body.routes[0].summary.distance/1000;
			ret.time += body.routes[0].summary.duration;
			ret.ascent += body.routes[0].summary.ascent;
			ret.descent += body.routes[0].summary.descent;
		}

		return ret;
	}

};