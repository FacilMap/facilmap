var Promise = require("bluebird");
var request = require("request-promise");

var config = require("../config");
var utils = require("./utils");

var ROUTING_URL = `https://api.openrouteservice.org/directions?api_key=${config.orsToken}`;

// The OpenLayers resolution for zoom level 1 is 0.7031249999891753
// and for zoom level 20 0.0000013411044763239684
// This is the distance of one pixel on the map in degrees
// The resolution for zoom level 19 is the resolution for zoom level 20 times 2, and so on.
// As we don’t need one route point per pixel, we raise the value a bit
var RESOLUTION_20 = 0.0000013411044763239684 * 4;

var ROUTING_TYPES = {
	car: "driving-car",
	bicycle: "cycling-regular",
	pedestrian: "foot-walking"
};

var MAX_DISTANCE = {
	car: 6000,
	bicycle: 300,
	pedestrian: 200
};

function calculateRouting(points, mode, simple) {
	let currentGroup = [];
	let coordGroups = [currentGroup];
	for(let point of points) {
		if(utils.calculateDistance(currentGroup.concat([point])) >= MAX_DISTANCE[mode]) {
			if(currentGroup.length == 1)
				return Promise.reject(new Error("Too much distance between route points. Consider adding some via points."));

			coordGroups.push(currentGroup = [currentGroup[currentGroup.length-1]]);

			if(utils.calculateDistance(currentGroup.concat([point])) >= MAX_DISTANCE[mode])
				return Promise.reject(new Error("Too much distance between route points. Consider adding some via points."));
		}

		currentGroup.push(point);
	}

	return Promise.all(coordGroups.map((coords) => {
		let url = ROUTING_URL
			+ "&coordinates=" + coords.map((point) => (point.lon + "," + point.lat)).join("|")
			+ "&profile=" + ROUTING_TYPES[mode]
			+ "&geometry_format=polyline"
			+ "&instructions=false"
			+ "&elevation=true";
			//+ "&extra_info=surface|waytype|steepness|tollways";

		return request.get({
			url: url,
			json: true,
			gzip: true,
			headers: {
				'User-Agent': process.env.fmUserAgent
			}
		});
	})).then((results) => {
		let ret = {
			trackPoints: [],
			distance: 0,
			time: 0,
			ascent: 0,
			descent: 0
		};

		for(let body of results) {
			if(body && body.error)
				throw new Error(body.error.message);

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

		if(!simple)
			_calculateZoomLevels(ret.trackPoints);

		return ret;
	}).catch((err) => {
		if(err.response.body && err.response.body.error)
			throw new Error(err.response.body.error.message);
		else
			throw err;
	});
}

function _calculateZoomLevels(points) {
	var segments = [ ];
	var dist = 0;
	for(var i=0; i<points.length; i++) {
		if(i > 0)
			dist += _distance(points[i-1], points[i]);
		segments[i] = dist / RESOLUTION_20;

		points[i].zoom = null;

		if(i != 0 && i != points.length-1) {
			var lastSegments = segments[i-1];
			var thisSegments = segments[i];
			for(var j = 0; j < 20; j++) {
				lastSegments = Math.floor(lastSegments / 2);
				thisSegments = Math.floor(thisSegments / 2);
				if(lastSegments == thisSegments) {
					points[i].zoom = 20 - j;
					break;
				}
			}
		}

		if(points[i].zoom == null)
			points[i].zoom = 1;
	}
}

function _distance(pos1, pos2) {
	return Math.sqrt(Math.pow(pos1.lon-pos2.lon, 2) + Math.pow(pos1.lat-pos2.lat, 2));
}

function prepareForBoundingBox(points, bbox, getCompleteBasicRoute) {
	points = _filterByZoom(points, Math.max(bbox.zoom, getCompleteBasicRoute ? 5 : 0));
	points = _filterByBbox(points, bbox, getCompleteBasicRoute);
	return points;
}

function _filterByZoom(points, zoom) {
	var ret = [ ];
	for(var i=0; i<points.length; i++) {
		if(points[i].zoom <= zoom)
			ret.push(points[i]);
	}
	return ret;
}

function _filterByBbox(points, bbox, getCompleteBasicRoute) {
	var ret = [ ];
	var lastIn = false;
	for(var i=0; i<points.length; i++) {
		var isIn = utils.isInBbox(points[i], bbox);
		if(isIn && !lastIn && i >= 1) {
			ret.push(points[i-1]);
		}
		if(isIn || lastIn || (getCompleteBasicRoute && points[i].zoom <= 5))
			ret.push(points[i]);

		lastIn = isIn;
	}
	return ret;
}

exports.calculateRouting = calculateRouting;
exports._calculateZoomLevels = _calculateZoomLevels;
exports.prepareForBoundingBox = prepareForBoundingBox;