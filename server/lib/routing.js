var request = require("request");

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
			return callback("Invalid response from server.");
		if(body.route.routeError.message)
			return callback(body.route.routeError.message);

		var ret = {
			actualPoints : [ ],
			distance : body.route.distance,
			time : body.route.time
		}
		for(var i=0; i<body.route.shape.shapePoints.length; i+=2) {
			ret.actualPoints.push({ lat: 1*body.route.shape.shapePoints[i], lon: 1*body.route.shape.shapePoints[i+1] });
		}

		callback(null, ret);
	});
}

exports.calculateRouting = calculateRouting;