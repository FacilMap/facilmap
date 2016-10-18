module.exports = {
	userAgent : process.env.USER_AGENT || 'FacilPad (https://pad.facilmap.org/, cdauth@cdauth.eu)',
	host : null,
	port : 8080,
	db : {
		type: process.env.DB_TYPE || "mysql", // mysql, postgres, mariadb, sqlite
		host: process.env.DB_HOST || "localhost",
		port: process.env.DB_PORT || null,
		database: process.env.DB_NAME || "facilpad",
		user: process.env.DB_USER || "facilpad",
		password: process.env.DB_PASSWORD || "password"
	}
};