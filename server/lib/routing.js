var request = require("request");
var utils = require("./utils");
var config = require("../config");

var ROUTING_URL = "http://open.mapquestapi.com/directions/v2/route";
var API_KEY = "Fmjtd%7Cluur2qubl9%2C80%3Do5-9aangr";

// The OpenLayers resolution for zoom level 1 is 0.7031249999891753
// and for zoom level 20 0.0000013411044763239684
// This is the distance of one pixel on the map in degrees
// The resolution for zoom level 19 is the resolution for zoom level 20 times 2, and so on.
// As we don’t need one route point per pixel, we raise the value a bit
var RESOLUTION_20 = 0.0000013411044763239684 * 4;

function calculateRouting(points, mode, callback) {
	var json = {
		locations : [ ],
		options : {
			unit : "k",
			generalize : 0,
			narrativeType : "none",
			routeType : mode
		}
	};

	for(var i=0; i<points.length; i++)
		json.locations.push({ latLng : { lat: points[i].lat, lng: points[i].lon }});

	var url = ROUTING_URL + "?key="+API_KEY+"&inFormat=json&outFormat=json&json="+encodeURIComponent(JSON.stringify(json));
	request.get({
		url: url,
		json: true,
		headers: {
			'User-Agent': config.userAgent
		}
	}, function(err, res, body) {
		if(err)
			return callback(err);

		if(!body || !body.route)
			return callback("Invalid response from routing server.");
		if(body.route.routeError.message || (body.info.statuscode != 0 && body.info.messages.length > 0))
			return callback(body.route.routeError.message || body.info.messages.join(" "));
		if(!body.route.shape || !body.route.shape.shapePoints)
			return callback("Invalid response from routing server.");

		var ret = {
			trackPoints : [ ],
			distance : body.route.distance,
			time : body.route.time
		};
		for(var i=0; i<body.route.shape.shapePoints.length; i+=2) {
			ret.trackPoints.push({ lat: 1*body.route.shape.shapePoints[i], lon: 1*body.route.shape.shapePoints[i+1] });
		}
		_calculateZoomLevels(ret.trackPoints);

		callback(null, ret);
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