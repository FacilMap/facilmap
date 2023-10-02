import compression from "compression";
import * as ejs from "ejs";
import express, { Request, Response, static as expressStatic, NextFunction } from "express";
import { readFile } from "node:fs/promises";
import { createServer, Server as HttpServer } from "http";
import { PadId } from "facilmap-types";
import { createTable } from "./export/table.js";
import Database from "./database/database";
import { exportGeoJson } from "./export/geojson.js";
import { exportGpx } from "./export/gpx.js";
import domainMiddleware from "express-domain-middleware";
import { paths, serve } from "facilmap-frontend/build.js";
import { Manifest } from "vite";
import { Writable } from "stream";

const isDevMode = !!process.env.FM_DEV;

async function getManifest(): Promise<Manifest> {
	const manifest = await readFile(paths.manifest);
	return JSON.parse(manifest.toString());
}

type PathParams = {
	padId: PadId
}

export async function initWebserver(database: Database, port: number, host?: string): Promise<HttpServer> {
	const padMiddleware = async function(req: Request<PathParams>, res: Response<string>, next: NextFunction) {
		try {
			const [template, padData, manifest] = await Promise.all([
				readFile(paths.mapEjs).then((t) => t.toString()),
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
				})(),
				!isDevMode ? getManifest() : undefined
			]);

			let scripts: string[], preloadScripts: string[], styles: string[];
			if (isDevMode) {
				scripts = ["@vite/client", paths.mapEntry];
				preloadScripts = [];
				styles = [];
			} else {
				const mainChunk = manifest![paths.mapEntry];
				scripts = [mainChunk.file];
				preloadScripts = [...mainChunk.imports ?? [], ...mainChunk.dynamicImports ?? []].map((key) => manifest![key].file);
				styles = mainChunk.css ?? [];
			}

			res.type("html");

			if (padData && padData.id == null) {
				res.status(404);
			}

			res.send(ejs.render(template, {
				padData: padData,
				isReadOnly: padData?.id == req.params.padId,
				config: {},
				scripts,
				preloadScripts,
				styles,
				paths
			}));
		} catch (err: any) {
			next(err);
		}
	};

	const app = express();
	app.use(domainMiddleware);
	app.use(compression());

	/* app.get("/frontend-:hash.js", function(req, res, next) {
		res.setHeader('Cache-Control', 'public, max-age=31557600'); // one year

		next();
	}); */

	app.get("/", padMiddleware);
	//app.get("/map.ejs", padMiddleware);
	//app.get("/table.ejs", padMiddleware);

	if (isDevMode) {
		const devServer = await serve({
			server: {
				middlewareMode: true,
				/* hmr: {
					protocol: 'ws',
					host: '127.0.0.1'
				} */
				//origin: "http://localhost:40829"
			},
			appType: "custom"
		});

		app.use(devServer.middlewares);
	} else {
		app.use(paths.base, expressStatic(paths.dist));
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
			exportGpx(database, padData ? padData.id : req.params.padId, req.query.useTracks == "1", req.query.filter as string | undefined).pipeTo(Writable.toWeb(res));
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
