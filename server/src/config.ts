import type { Options as SequelizeOptions } from "sequelize";
import "dotenv/config";

export interface DbConfig {
	type: SequelizeOptions['dialect'];
	host: SequelizeOptions['host'];
	port: SequelizeOptions['port'];
	database: string;
	user: string;
	password: string;
}

export interface Config {
	appName: string;
	userAgent: string;
	trustProxy?: boolean | string | string[] | number | ((ip: string) => boolean);
	baseUrl?: string;
	host?: string;
	port: number;
	db: DbConfig;
	orsToken?: string;
	mapboxToken?: string;
	mapzenToken?: string;
	maxmindUserId?: string;
	maxmindLicenseKey?: string;
	limaLabsToken?: string;
	/** Hide the "Open this on Google/Bing Maps" links in the map style menu */
	hideCommercialMapLinks?: boolean;
}

const config: Config = {
	appName: process.env.APP_NAME || "FacilMap",
	userAgent: process.env.USER_AGENT || 'FacilMap',
	trustProxy: (
		!process.env.TRUST_PROXY ? undefined :
		process.env.TRUST_PROXY === "true" ? true :
		process.env.TRUST_PROXY.match(/^\d+$/) ? Number(process.env.TRUST_PROXY) :
		process.env.TRUST_PROXY
	),
	baseUrl: process.env.BASE_URL ? (process.env.BASE_URL.endsWith("/") ? process.env.BASE_URL : `${process.env.BASE_URL}/`) : undefined,
	host: process.env.HOST || undefined,
	port: process.env.PORT ? Number(process.env.PORT) : 8080,
	db : {
		type: process.env.DB_TYPE as any || "mysql", // mysql, postgres, mariadb, sqlite
		host: process.env.DB_HOST || "localhost",
		port: Number(process.env.DB_PORT) || undefined,
		database: process.env.DB_NAME || "facilmap",
		user: process.env.DB_USER || "facilmap",
		password: process.env.DB_PASSWORD || "facilmap"
	},
	orsToken: process.env.ORS_TOKEN || "", // Get a token on https://go.openrouteservice.org/
	mapboxToken: process.env.MAPBOX_TOKEN || "", // Get an API key on https://www.mapbox.com/signup/
	mapzenToken: process.env.MAPZEN_TOKEN || "", // Get an API key on https://mapzen.com/developers/sign_up

	// Maxmind configuration. If specified, the maxmind GeoLite2 database will be downloaded for Geo IP lookup (to show the initial map state) and kept it in memory
	// Sign up here: https://www.maxmind.com/en/geolite2/signup
	maxmindUserId: process.env.MAXMIND_USER_ID || "",
	maxmindLicenseKey: process.env.MAXMIND_LICENSE_KEY || "",

	limaLabsToken: process.env.LIMA_LABS_TOKEN || "", // Get a token on https://maps.lima-labs.com/,

	hideCommercialMapLinks: process.env.HIDE_COMMERCIAL_MAP_LINKS === "1",
};

export default config;
