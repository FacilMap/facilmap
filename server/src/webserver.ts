import compression from "compression";
import express, { type Request, type Response, type NextFunction } from "express";
import { createServer, type Server as HttpServer } from "http";
import type { PadId } from "facilmap-types";
import { createTable } from "./export/table.js";
import Database from "./database/database";
import { exportGeoJson } from "./export/geojson.js";
import { exportGpx } from "./export/gpx.js";
import domainMiddleware from "express-domain-middleware";
import { Readable, Writable } from "stream";
import { getStaticFrontendMiddleware, renderMap, type RenderMapParams } from "./frontend";

type PathParams = {
	padId: PadId
}

export async function initWebserver(database: Database, port: number, host?: string): Promise<HttpServer> {
	const padMiddleware = async function(req: Request<PathParams>, res: Response<string>, next: NextFunction) {
		try {
			let params: RenderMapParams;
			if(req.params?.padId) {
				const padData = await database.pads.getPadDataByAnyId(req.params.padId);
				if (padData) {
					params = {
						padData,
						isReadOnly: padData.id === req.params.padId
					};
				} else {
					res.status(404);
					params = {
						padData: {
							searchEngines: false,
							name: "",
							description: ""
						},
						isReadOnly: true
					};
				}
			} else {
				params = {
					padData: undefined,
					isReadOnly: true
				};
			}

			res.type("html");
			res.send(await renderMap(params));
		} catch (err: any) {
			next(err);
		}
	};

	const app = express();
	app.use(domainMiddleware);
	app.use(compression());

	app.get("/", padMiddleware);

	app.use(await getStaticFrontendMiddleware());

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
			res.type("html");
			res.send(await createTable(
				database,
				req.params.padId,
				req.query.filter as string | undefined,
				req.query.hide ? (req.query.hide as string).split(',') : []
			));
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

			const result = exportGeoJson(database, req.params.padId, req.query.filter as string | undefined);
			Readable.fromWeb(result).pipe(res);
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
