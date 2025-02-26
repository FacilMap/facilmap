import type { Options as SequelizeOptions } from "sequelize";
import "dotenv/config";
import { setConfig, setFetchAdapter } from "facilmap-utils";

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
	maxmindUserId?: string;
	maxmindLicenseKey?: string;
	limaLabsToken?: string;
	thunderforestToken?: string;
	tracestrackToken?: string;
	/** Hide the "Open this on Google/Bing Maps" links in the map style menu */
	hideCommercialMapLinks?: boolean;
	customCssFile?: string;
	nominatimUrl: string;
	openElevationApiUrl: string;
	openElevationThrottleMs: number;
	openElevationMaxBatchSize: number;
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

	// Maxmind configuration. If specified, the maxmind GeoLite2 database will be downloaded for Geo IP lookup (to show the initial map state) and kept it in memory
	// Sign up here: https://www.maxmind.com/en/geolite2/signup
	maxmindUserId: process.env.MAXMIND_USER_ID || "",
	maxmindLicenseKey: process.env.MAXMIND_LICENSE_KEY || "",

	limaLabsToken: process.env.LIMA_LABS_TOKEN || "", // Get a token on https://maps.lima-labs.com/
	thunderforestToken: process.env.THUNDERFOREST_TOKEN || "", // Get a token on https://www.thunderforest.com/
	tracestrackToken: process.env.TRACESTRACK_TOKEN || "", // Get a token on https://tracestrack.com/

	hideCommercialMapLinks: process.env.HIDE_COMMERCIAL_MAP_LINKS === "1",

	customCssFile: process.env.CUSTOM_CSS_FILE || undefined,

	nominatimUrl: process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org",

	openElevationApiUrl: process.env.OPEN_ELEVATION_URL || "https://api.open-elevation.com",
	openElevationThrottleMs: process.env.OPEN_ELEVATION_THROTTLE_MS ? Number(process.env.OPEN_ELEVATION_THROTTLE_MS) : 1000, // Maximum one request per second, see https://github.com/Jorl17/open-elevation/issues/3
	openElevationMaxBatchSize: process.env.OPEN_ELEVATION_MAX_BATCH_SIZE ? Number(process.env.OPEN_ELEVATION_MAX_BATCH_SIZE) : 200,
};

setConfig({
	openElevationApiUrl: config.openElevationApiUrl,
	openElevationThrottleMs: config.openElevationThrottleMs,
	openElevationMaxBatchSize: config.openElevationMaxBatchSize,
	nominatimUrl: config.nominatimUrl
});

setFetchAdapter(async (input, init) => {
	const headers = new Headers(init?.headers);
	headers.set("User-Agent", config.userAgent);
	return await fetch(input, { ...init, headers });
});

export default config;
