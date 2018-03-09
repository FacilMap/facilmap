const Promise = require("bluebird");
const request = require("request-promise");

const config = require("../../config");

const ROUTING_URL = "https://api.mapbox.com/directions/v5/mapbox";

const ROUTING_TYPES = {
	car: "driving",
	bicycle: "cycling",
	pedestrian: "walking"
};

const MAX_POINTS_PER_REQUEST = 25;

const osrm = module.exports = {

	async calculateRouting(points, mode, simple=false) {
		let coordGroups = [[]];
		for(let point of points) {
			if(coordGroups[coordGroups.length-1].length >= MAX_POINTS_PER_REQUEST)
				coordGroups.push([]);

			coordGroups[coordGroups.length-1].push(point.lon + "," + point.lat);
		}

		const results = await Promise.all(coordGroups.map((coords) => {
			let url = ROUTING_URL + "/" + ROUTING_TYPES[mode] + "/" + coords.join(";")
				+ "?alternatives=false"
				+ "&steps=false"
				+ "&geometries=geojson"
				+ "&overview=" + (simple ? "simplified" : "full")
				+ "&access_token=" + encodeURIComponent(config.mapboxToken);

			return request.get({
				url: url,
				json: true,
				gzip: true,
				headers: {
					'User-Agent': process.env.fmUserAgent
				}
			});
		}));

		let ret = {
			trackPoints: [],
			distance: 0,
			time: 0
		};

		for(let body of results) {
			if(!body || (body.code == "OK" && (!body.legs || !body.legs[0])))
				throw new Error("Invalid response from routing server.");

			if(body.code != 'Ok')
				throw new Error("Route could not be calculated (" + body.code + ").");

			let trackPoints = body.routes[0].geometry.coordinates.map(function(it) { return { lat: it[1], lon: it[0] }; });
			if(trackPoints.length > 0 && ret.trackPoints.length > 0 && trackPoints[0].lat == ret.trackPoints[ret.trackPoints.length-1].lat && trackPoints[0].lon == ret.trackPoints[ret.trackPoints.length-1].lon)
				trackPoints.shift();

			ret.trackPoints.push(...trackPoints);
			ret.distance += body.routes[0].distance/1000;
			ret.time += body.routes[0].duration;
		}

		return ret;
	}

};
