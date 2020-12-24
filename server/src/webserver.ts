import { promiseAuto } from "./utils/utils";
import compression from "compression";
import ejs from "ejs";
import express, { Request, Response, NextFunction } from "express";
const fs = require("fs").promises;
import { createServer } from "http2";
import jsonFormat from "json-format";
import { dirname } from "path";
import { promisify } from "util";
import { PadId } from "facilmap-types";
import { createTable } from "./export/table";
import database from "./database/database";
import geojson from "./export/geojson";
const gpx = require("./export/gpx");
const table = require("./export/table");
const config = require("../../config");

const frontendPath = dirname(require.resolve("facilmap-frontend/package.json")); // Do not resolve main property

if(process.env.FM_DEV)
	process.chdir(frontendPath); // To make sure that webpack finds all the loaders

const webpackCompiler = process.env.FM_DEV ? require("webpack")(require("facilmap-frontend/webpack.config")) : null;

const staticMiddleware = process.env.FM_DEV
	? require("webpack-dev-middleware")(webpackCompiler, { // require the stuff here so that it doesn't fail if devDependencies are not installed
		publicPath: "/"
	})
	: express.static(frontendPath + "/build/");

const hotMiddleware = process.env.FM_DEV ? require("webpack-hot-middleware")(webpackCompiler) : null;

type PathParams = {
	padId: PadId
}

export async function initWebserver(database: any, port: number, host: string) {
	const padMiddleware = function(req: Request<PathParams>, res: Response<string>, next: NextFunction) {
		promiseAuto({
			template: () => getFrontendFile("index.ejs"),

			padData: () => {
				if(req.params && req.params.padId) {
					return database.getPadData(req.params.padId).then((padData) => {
						// We only look up by read ID. At the moment, we only need the data for the search engine
						// meta tags, and those should be only enabled in the read-only version anyways.

						if (!padData)
							throw new Error();
						return padData;
					}).catch(() => {
						// Error will be handled on the client side when it tries to fetch the pad data
						return {
							searchEngines: false,
							description: ""
						};
					});
				}
			},

			render: async (template, padData) => {
				res.type("html");
				res.send(ejs.render(template, {
					padData: padData,
					config: {}
				}));
			}
		}).catch(next);
	};


	let app = express();
	app.use(compression());

	app.get("/bundle-:hash.js", function(req, res, next) {
		res.setHeader('Cache-Control', 'public, max-age=31557600'); // one year

		next();
	});

	app.get("/", padMiddleware);
	app.get("/index.ejs", padMiddleware);
	app.get("/table.ejs", padMiddleware);

	app.use(staticMiddleware);
	if(process.env.FM_DEV) {
		app.use(hotMiddleware);
	}

	// If no file with this name has been found, we render a pad
	app.get("/:padId", padMiddleware);

	app.get("/:padId/gpx", function(req: Request<PathParams>, res: Response<string>, next) {
		promiseAuto({
			padData: database.getPadDataByAnyId(req.params.padId).then((padData) => {
				if(!padData)
					throw new Error(`Map with ID ${req.params.padId} could not be found.`);
				return padData;
			}),
			gpx: (padData) => {
				return gpx.exportGpx(database, padData ? padData.id : req.params.padId, req.query.useTracks == "1", req.query.filter);
			},
			response: async (padData, gpx) => {
				res.set("Content-type", "application/gpx+xml");
				res.attachment(padData.name.replace(/[\\\/:*?"<>|]+/g, '_') + ".gpx");
				res.send(gpx);
			}
		}).catch(next);
	});

	app.get("/:padId/table", function(req: Request<PathParams>, res: Response<string>, next) {
		return createTable(database, req.params.padId, req.query.filter, req.query.hide ? req.query.hide.split(',') : []).then((renderedTable) => {
			res.type("html");
			res.send(renderedTable);
		}).catch(next);
	});

	app.get("/:padId/geojson", function(req: Request<PathParams>, res: Response<string>, next) {
		promiseAuto({
			padData: database.getPadData(req.params.padId).then((padData) => {
				if(!padData)
					throw new Error(`Map with ID ${req.params.padId} could not be found.`);
				return padData;
			}),
			geojson: () => {
				return geojson.exportGeoJson(database, req.params.padId, req.query.filter);
			},
			response: async (padData, geojson) => {
				res.set("Content-type", "application/geo+json");
				res.attachment(padData.name.replace(/[\\\/:*?"<>|]+/g, '_') + ".geojson");
				res.send(jsonFormat(geojson));
			}
		}).catch(next);
	});

	const server = createServer(app);
	await promisify(server.listen.bind(server))({
		port,
		host
	});
	return server;
}

export function getFrontendFile(path: string): Promise<string> {
	if (process.env.FM_DEV) {
		return new Promise((resolve, reject) => {
			staticMiddleware.waitUntilValid(resolve);
		}).then(() => {
			return staticMiddleware.fileSystem.readFileSync(staticMiddleware.getFilenameFromUrl(`/${path}`), "utf8");
		});
	} else {
		// We don't want express.static's ETag handling, as it sometimes returns an empty template,
		// so we have to read it directly from the file system

		return fs.readFile(`${frontendPath}/build/${path}`, "utf8");
	}
}
