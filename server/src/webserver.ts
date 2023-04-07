import compression from "compression";
import * as ejs from "ejs";
import express, { Request, Response, static as expressStatic, NextFunction } from "express";
import fs from "fs";
import { createServer, Server as HttpServer } from "http";
import { dirname } from "path";
import { PadId } from "facilmap-types";
import { createTable } from "./export/table.js";
import Database from "./database/database";
import { exportGeoJson } from "./export/geojson.js";
import { exportGpx } from "./export/gpx.js";
import domainMiddleware from "express-domain-middleware";
import { createRequire } from 'module';

// https://stackoverflow.com/a/62499498/242365
const require = createRequire(import.meta.url);
const frontendPath = dirname(require.resolve("facilmap-frontend/package.json")); // Do not resolve main property

const isDevMode = !!process.env.FM_DEV;

/* eslint-disable @typescript-eslint/no-var-requires */
const webpackCompiler = isDevMode ? (() => {
	const webpack = require(require.resolve("webpack", { paths: [ require.resolve("facilmap-frontend/package.json") ] }));
	const webpackConfig = require("facilmap-frontend/webpack.config");
	return webpack(webpackConfig({}, { mode: "development" }).find((conf: any) => conf.name == "app"));
})() : undefined;

const staticMiddleware = isDevMode
	? require("webpack-dev-middleware")(webpackCompiler, { // require the stuff here so that it doesn't fail if devDependencies are not installed
		publicPath: "/"
	})
	: expressStatic(frontendPath + "/dist/");

const hotMiddleware = isDevMode ? require("webpack-hot-middleware")(webpackCompiler) : undefined;

type PathParams = {
	padId: PadId
}

export async function initWebserver(database: Database, port: number, host?: string): Promise<HttpServer> {
	const padMiddleware = function(req: Request<PathParams>, res: Response<string>, next: NextFunction) {
		Promise.all([
			getFrontendFile("map.ejs"),
			(async () => {
				if(req.params && req.params.padId) {
					return database.pads.getPadDataByAnyId(req.params.padId).then((padData) => {
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
				isReadOnly: padData?.id == req.params.padId,
				config: {}
			}));
		}).catch(next);
	};

	const app = express();
	app.use(domainMiddleware);
	app.use(compression());

	app.get("/frontend-:hash.js", function(req, res, next) {
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

			res.set("Content-type", "application/gpx+xml");
			res.attachment(padData.name.replace(/[\\/:*?"<>|]+/g, '_') + ".gpx");
			exportGpx(database, padData ? padData.id : req.params.padId, req.query.useTracks == "1", req.query.filter as string | undefined).pipe(res);
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
			const padData = await database.pads.getPadData(req.params.padId);

			if(!padData)
				throw new Error(`Map with ID ${req.params.padId} could not be found.`);

			res.set("Content-type", "application/geo+json");
			res.attachment(padData.name.replace(/[\\/:*?"<>|]+/g, '_') + ".geojson");
			exportGeoJson(database, req.params.padId, req.query.filter as string | undefined).pipe(res);
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

		return fs.promises.readFile(`${frontendPath}/dist/${path}`, "utf8");
	}
}
