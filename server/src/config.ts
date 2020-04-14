import { Options as SequelizeOptions } from "sequelize";

export interface DbConfig {
	type: SequelizeOptions['dialect'];
	host: SequelizeOptions['host'];
	port: SequelizeOptions['port'];
	database: string;
	user: string;
	password: string;
}

interface Config {
	userAgent: string;
	host?: string;
	port: number;
	db: DbConfig;
	orsToken?: string;
	mapboxToken?: string;
	mapzenToken?: string;
	maxmindUserId?: string;
	maxmindLicenseKey?: string;
}

const config: Config = {
	userAgent: process.env.USER_AGENT || 'FacilMap (https://facilmap.org/)',
	host: process.env.HOST || undefined,
	port: process.env.PORT ? Number(process.env.PORT) : 8080,
	db : {
		type: process.env.DB_TYPE as any || "mysql", // mysql, postgres, mariadb, sqlite
		host: process.env.DB_HOST || "localhost",
		port: Number(process.env.DB_PORT) || undefined,
		database: process.env.DB_NAME || "facilmap",
		user: process.env.DB_USER || "facilmap",
		password: process.env.DB_PASSWORD || "password"
	},
	orsToken: process.env.OSR_TOKEN || "", // Get a token on https://go.openrouteservice.org/
	mapboxToken: process.env.MAPBOX_TOKEN || "", // Get an API key on https://www.mapbox.com/signup/
	mapzenToken: process.env.MAPZEN_TOKEN || "", // Get an API key on https://mapzen.com/developers/sign_up

	// Maxmind configuration. If specified, the maxmind GeoLite2 database will be downloaded for Geo IP lookup (to show the initial map state) and kept it in memory
	// Sign up here: https://www.maxmind.com/en/geolite2/signup
	maxmindUserId: process.env.MAXMIND_USER_ID || "",
	maxmindLicenseKey: process.env.MAXMIND_LICENSE_KEY || "",
};