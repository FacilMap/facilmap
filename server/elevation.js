const polyline = require("@mapbox/polyline");
const request = require("request-promise").defaults({
	gzip: true,
	headers: {
		'User-Agent': process.env.fmUserAgent
	}
});


const API_URL = "https://elevation.mapzen.com/height";
const API_KEY = "mapzen-LWPWRB1";


const elevation = module.exports = {

	getElevationForPoint(point) {
		return elevation.getElevationForPoints([point]).then((points) => (points[0]));
	},

	getElevationForPoints(points) {
		if(points.length == 0)
			return [ ];

		let json = {
			encoded_polyline: polyline.encode(points.map((point) => ([point.lat, point.lon])), 6),
			range: false
		};

		return request.get({
			url: `${API_URL}?json=${encodeURI(JSON.stringify(json))}&api_key=${API_KEY}`,
			json: true
		}).then((res) => (res.height));
	}

};
