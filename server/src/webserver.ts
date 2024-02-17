import compression from "compression";
import express, { type Request, type Response } from "express";
import { createServer, type Server as HttpServer } from "http";
import type { PadId } from "facilmap-types";
import { createTable } from "./export/table.js";
import Database from "./database/database";
import { exportGeoJson } from "./export/geojson.js";
import { exportGpx } from "./export/gpx.js";
import domainMiddleware from "express-domain-middleware";
import { Readable, Writable } from "stream";
import { getStaticFrontendMiddleware, renderMap, type RenderMapParams } from "./frontend";
import { normalizePadName } from "facilmap-utils";

type PathParams = {
	padId: PadId
}

export async function initWebserver(database: Database, port: number, host?: string): Promise<HttpServer> {
	const padMiddleware = async (req: Request<PathParams>, res: Response<string>) => {
		let params: RenderMapParams;
		if(req.params?.padId) {
			const padData = await database.pads.getPadDataByAnyId(req.params.padId);
			if (padData) {
				params = {
					padData: {
						searchEngines: padData.searchEngines,
						name: normalizePadName(padData.name),
						description: padData.description
					},
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
	};

	const app = express();
	app.use(domainMiddleware);
	app.use(compression());

	app.get("/", padMiddleware);

	app.use(await getStaticFrontendMiddleware());

	// If no file with this name has been found, we render a pad
	app.get("/:padId", padMiddleware);

	app.get("/:padId/gpx", async (req: Request<PathParams>, res: Response<string>) => {
		const padData = await database.pads.getPadDataByAnyId(req.params.padId);

		if(!padData)
			throw new Error(`Map with ID ${req.params.padId} could not be found.`);

		res.set("Content-type", "application/gpx+xml");
		res.attachment(padData.name.replace(/[\\/:*?"<>|]+/g, '_') + ".gpx");
		exportGpx(database, padData ? padData.id : req.params.padId, req.query.useTracks == "1", req.query.filter as string | undefined).pipeTo(Writable.toWeb(res));
	});

	app.get("/:padId/table", async (req: Request<PathParams>, res: Response<string>) => {
		res.type("html");
		res.send(await createTable(
			database,
			req.params.padId,
			req.query.filter as string | undefined,
			req.query.hide ? (req.query.hide as string).split(',') : []
		));
	});

	app.get("/:padId/geojson", async (req: Request<PathParams>, res: Response<string>) => {
		const padData = await database.pads.getPadData(req.params.padId);

		if(!padData)
			throw new Error(`Map with ID ${req.params.padId} could not be found.`);

		res.set("Content-type", "application/geo+json");
		res.attachment(padData.name.replace(/[\\/:*?"<>|]+/g, '_') + ".geojson");

		const result = exportGeoJson(database, req.params.padId, req.query.filter as string | undefined);
		Readable.fromWeb(result).pipe(res);
	});

	const server = createServer(app);
	await new Promise<void>((resolve) => {
		server.listen({ port, host }, resolve);
	});
	return server;
}
