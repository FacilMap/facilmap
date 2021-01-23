import compression from "compression";
import ejs from "ejs";
import express, { Request, Response, NextFunction } from "express";
import fs from "fs";
import { createServer, Server as HttpServer } from "http";
import jsonFormat from "json-format";
import { dirname } from "path";
import { PadId } from "facilmap-types";
import { createTable } from "./export/table";
import Database from "./database/database";
import { exportGeoJson } from "./export/geojson";
import { exportGpx } from "./export/gpx";

const frontendPath = dirname(require.resolve("facilmap-frontend/package.json")); // Do not resolve main property

const isDevMode = !!process.env.FM_DEV;

/* eslint-disable @typescript-eslint/no-var-requires */
const webpackCompiler = isDevMode ? require(require.resolve("webpack", { paths: [ require.resolve("facilmap-frontend/package.json") ] }))(require("facilmap-frontend/webpack.config")) : null;

const staticMiddleware = isDevMode
	? require("webpack-dev-middleware")(webpackCompiler, { // require the stuff here so that it doesn't fail if devDependencies are not installed
		publicPath: "/"
	})
	: express.static(frontendPath + "/build/");

const hotMiddleware = isDevMode ? require("webpack-hot-middleware")(webpackCompiler) : null;

type PathParams = {
	padId: PadId
}

export async function initWebserver(database: Database, port: number, host?: string): Promise<HttpServer> {
	const padMiddleware = function(req: Request<PathParams>, res: Response<string>, next: NextFunction) {
		Promise.all([
			getFrontendFile("map.ejs"),
			(async () => {
				if(req.params && req.params.padId) {
					return database.pads.getPadData(req.params.padId).then((padData) => {
						// We only look up by read ID. At the moment, we only need the data for the search engine
						// meta tags, and those should be only enabled in the read-only version anyways.

						if (!padData)
							throw new Error();
						return padData;
					}).catch(() => {
						// Error will be handled on the client side when it tries to fetch the pad data
						return {
							id: undefined,
							searchEngines: false,
							description: ""
						};
					});
				}
			})()
		]).then(([ template, padData ]) => {
			res.type("html");

			if (padData && padData.id == null) {
				res.status(404);
			}

			res.send(ejs.render(template, {
				padData: padData,
				config: {}
			}));
		}).catch(next);
	};

	const app = express();
	app.use(compression());

	app.get("/bundle-:hash.js", function(req, res, next) {
		res.setHeader('Cache-Control', 'public, max-age=31557600'); // one year

		next();
	});

	app.get("/", padMiddleware);
	app.get("/map.ejs", padMiddleware);
	app.get("/table.ejs", padMiddleware);

	app.use(staticMiddleware);
	if(isDevMode) {
		app.use(hotMiddleware);
	}

	// If no file with this name has been found, we render a pad
	app.get("/:padId", padMiddleware);

	app.get("/:padId/gpx", async function(req: Request<PathParams>, res: Response<string>, next) {
		try {
			const padData = await database.pads.getPadDataByAnyId(req.params.padId);
			
			if(!padData)
				throw new Error(`Map with ID ${req.params.padId} could not be found.`);
			
			const gpx = await exportGpx(database, padData ? padData.id : req.params.padId, req.query.useTracks == "1", req.query.filter as string | undefined);
			
			res.set("Content-type", "application/gpx+xml");
			res.attachment(padData.name.replace(/[\\/:*?"<>|]+/g, '_') + ".gpx");
			res.send(gpx);
		} catch (e) {
			next(e);
		}
	});

	app.get("/:padId/table", async function(req: Request<PathParams>, res: Response<string>, next) {
		try {
			const renderedTable = await createTable(database, req.params.padId, req.query.filter as string | undefined, req.query.hide ? (req.query.hide as string).split(',') : []);
			
			res.type("html");
			res.send(renderedTable);
		} catch (e) {
			next(e);
		}
	});

	app.get("/:padId/geojson", async function(req: Request<PathParams>, res: Response<string>, next) {
		try {
			const [padData, geojson] = await Promise.all([
				database.pads.getPadData(req.params.padId),
				exportGeoJson(database, req.params.padId, req.query.filter as string | undefined)
			]);

			if(!padData)
				throw new Error(`Map with ID ${req.params.padId} could not be found.`);
			
			res.set("Content-type", "application/geo+json");
			res.attachment(padData.name.replace(/[\\/:*?"<>|]+/g, '_') + ".geojson");
			res.send(jsonFormat(geojson));
		} catch (e) {
			next(e);
		}
	});

	const server = createServer(app);
	await new Promise<void>((resolve) => {
		server.listen({ port, host }, resolve);
	});
	return server;
}

export function getFrontendFile(path: string): Promise<string> {
	if (isDevMode) {
		return new Promise((resolve) => {
			staticMiddleware.waitUntilValid(resolve);
		}).then(() => {
			return webpackCompiler.outputFileSystem.readFileSync(`${webpackCompiler.outputPath}${path}`, "utf8");
		});
	} else {
		// We don't want express.static's ETag handling, as it sometimes returns an empty template,
		// so we have to read it directly from the file system

		return fs.promises.readFile(`${frontendPath}/build/${path}`, "utf8");
	}
}
