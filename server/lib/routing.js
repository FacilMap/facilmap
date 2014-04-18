var request = require("request");
var utils = require("./utils");

var ROUTING_URL = "http://open.mapquestapi.com/directions/v2/route";
var API_KEY = "Fmjtd%7Cluur2qubl9%2C80%3Do5-9aangr";

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
	request.get({ url: url, json: true }, function(err, res, body) {
		if(err)
			return callback(err);

		if(!body || !body.route)
			return callback("Invalid response from routing server.");
		if(body.route.routeError.message)
			return callback(body.route.routeError.message);
		if(!body.route.shape || !body.route.shape.shapePoints)
			return callback("Invalid response from routing server.");

		var ret = {
			actualPoints : [ ],
			distance : body.route.distance,
			time : body.route.time
		};
		for(var i=0; i<body.route.shape.shapePoints.length; i+=2) {
			ret.actualPoints.push({ lat: 1*body.route.shape.shapePoints[i], lon: 1*body.route.shape.shapePoints[i+1] });
		}

		callback(null, ret);
	});
}

function prepareLineForBoundingBox(line, bbox) {
	var ret = utils.extend({ }, line);
	ret.actualPoints = prepareForBoundingBox(line.actualPoints, bbox);
	return ret;
}

function prepareForBoundingBox(posList, bbox) {
	posList = _stripPointsOutsideBbox(posList, bbox);
	posList = _stripPointsToMinimumDistance(posList, bbox.resolution);
	return posList;
}

function _stripPointsOutsideBbox(posList, bbox) {
	var inBbox = [ ];
	for(var i=0; i<posList.length; i++) {
		inBbox[i] = utils.isInBbox(posList[i], bbox);
	}

	var ret = [ ];
	for(var i=0; i<posList.length; i++) {
		if(inBbox[i] || inBbox[i-1] || inBbox[i+1])
			ret.push(posList[i]);
	}
	return ret;
}

function _stripPointsToMinimumDistance(posList, minDist) {
	if(posList.length <= 2 || minDist == null || minDist <= 0)
		return posList;

	function dist(pos1, pos2) {
		return Math.sqrt(Math.pow(pos1.lon-pos2.lon, 2) + Math.pow(pos1.lat-pos2.lat, 2));
	}

	function percentagePos(pos1, pos2, percentage) {
		return {
			lat : pos1.lat + percentage * (pos2.lat - pos1.lat),
			lon : pos1.lon + percentage * (pos2.lon - pos1.lon)
		};
	}

	var ret = [ posList[0] ];

	var currentDist = 0;
	var lastPoint = ret[0];
	for(var i=1; i<posList.length; i++) {
		var thisDist = dist(lastPoint, posList[i]);
		if(currentDist + thisDist < minDist) {
			currentDist += thisDist;
			lastPoint = posList[i];
		} else {
			// Add the point where currentDist is exactly minDist
			lastPoint = percentagePos(lastPoint, posList[i], (minDist-currentDist) / thisDist);
			ret.push(lastPoint);
			//ret.push(posList[i])
			currentDist = 0;

			// And then do the same thing with this point again
			i--;
		}
	}

	ret.push(posList[posList.length-1]);

	return ret;
}

exports.calculateRouting = calculateRouting;
exports.prepareForBoundingBox = prepareForBoundingBox;
exports.prepareLineForBoundingBox = prepareLineForBoundingBox;