var request = require("request-promise");
var utils = require("./utils");
var config = require("../config");
var Promise = require("promise");

var ROUTING_URL = "https://api.mapbox.com/directions/v5/mapbox";

// The OpenLayers resolution for zoom level 1 is 0.7031249999891753
// and for zoom level 20 0.0000013411044763239684
// This is the distance of one pixel on the map in degrees
// The resolution for zoom level 19 is the resolution for zoom level 20 times 2, and so on.
// As we don’t need one route point per pixel, we raise the value a bit
var RESOLUTION_20 = 0.0000013411044763239684 * 4;

var ROUTING_TYPES = {
	fastest: "driving",
	shortest: "driving",
	bicycle: "cycling",
	pedestrian: "walking"
};

var ACCESS_TOKEN = "pk.eyJ1IjoiY2RhdXRoIiwiYSI6ImNpdTYwMmZwMDAwM3AyenBhemM5NHM4ZmgifQ.93z6yuzcsxt3eZk9NxPGHA";

function calculateRouting(points, mode) {
	var coords = [ ];
	for(var i=0; i<points.length; i++)
		coords.push(points[i].lon + "," + points[i].lat);

	var url = ROUTING_URL + "/" + ROUTING_TYPES[mode] + "/" + coords.join(";") + "?alternatives=true&steps=false&geometries=geojson&overview=full&annotations=false&access_token=" + encodeURIComponent(ACCESS_TOKEN);
	return request.get({
		url: url,
		json: true,
		headers: {
			'User-Agent': config.userAgent
		}
	}).then(function(body) {
		if(!body || (body.code == "OK" && (!body.legs || !body.legs[0])))
			throw "Invalid response from routing server.";

		if(body.code != 'Ok')
			throw "Route could not be calculated (" + body.code + ").";

		var ret = {
			trackPoints : body.routes[0].geometry.coordinates.map(function(it) { return { lat: it[1], lon: it[0] }; }),
			distance: body.routes[0].distance/1000,
			time: body.routes[0].duration
		};

		_calculateZoomLevels(ret.trackPoints);

		return ret;
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

function prepareForBoundingBox(points, bbox) {
	points = _filterByZoom(points, bbox.zoom);
	points = _filterByBbox(points, bbox);
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

function _filterByBbox(points, bbox) {
	var ret = [ ];
	var lastIn = false;
	for(var i=0; i<points.length; i++) {
		var isIn = utils.isInBbox(points[i], bbox);
		if(isIn && !lastIn && i >= 1) {
			ret.push(points[i-1]);
		}
		if(isIn || lastIn)
			ret.push(points[i]);

		lastIn = isIn;
	}
	return ret;
}

exports.calculateRouting = calculateRouting;
exports.prepareForBoundingBox = prepareForBoundingBox;