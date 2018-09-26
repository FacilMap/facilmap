module.exports = {
	userAgent : process.env.USER_AGENT || 'FacilMap (https://facilmap.org/, cdauth@cdauth.eu)',
	host : null,
	port : 8080,
	db : {
		type: process.env.DB_TYPE || "mysql", // mysql, postgres, mariadb, sqlite
		host: process.env.DB_HOST || "localhost",
		port: process.env.DB_PORT || null,
		database: process.env.DB_NAME || "facilmap",
		user: process.env.DB_USER || "facilmap",
		password: process.env.DB_PASSWORD || "password"
	},
	orsToken: process.env.OSR_TOKEN || "", // Get a token on https://go.openrouteservice.org/
	mapboxToken: process.env.MAPBOX_TOKEN || "", // Get an API key on https://www.mapbox.com/signup/
	mapzenToken: process.env.MAPZEN_TOKEN || "", // Get an API key on https://mapzen.com/developers/sign_up
	maxmind: true, // Whether to download the maxmind GeoLite2 database for Geo IP lookup (to show the initial map state) and keep it in memory
};