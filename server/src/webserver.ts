import compression from "compression";
import express, { type Request, type Response } from "express";
import { createServer, type Server as HttpServer } from "http";
import { Writable, stringifiedIdValidator, type MapDataWithWritable } from "facilmap-types";
import { createSingleTable, createTable } from "./export/table.js";
import Database from "./database/database";
import { exportGeoJson } from "./export/geojson.js";
import { exportGpx, exportGpxZip } from "./export/gpx.js";
import domainMiddleware from "express-domain-middleware";
import { getOembedJson, getOpensearchXml, getPwaManifest, getStaticFrontendMiddleware, renderMap, type RenderMapParams } from "./frontend";
import { getSafeFilename, normalizeMapName, parseMapUrl } from "facilmap-utils";
import { paths } from "facilmap-frontend/build.js";
import config from "./config";
import { exportCsv } from "./export/csv.js";
import * as z from "zod";
import cookieParser from "cookie-parser";
import { i18nMiddleware } from "./i18n.js";
import { getApiMiddleware } from "./api/api.js";
import { readableFromWeb, writableToWeb } from "./utils/streams.js";

function getBaseUrl(req: Request): string {
	return config.baseUrl ?? `${req.protocol}://${req.host}/`;
}

export async function initWebserver(database: Database, port: number, host?: string): Promise<HttpServer> {
	const mapMiddleware = async (req: Request<{ mapSlug: string }>, res: Response<string>) => {
		const baseUrl = getBaseUrl(req);

		let params: RenderMapParams;
		if(req.params?.mapSlug) {
			try {
				const mapData = await database.maps.getMapDataBySlug(req.params.mapSlug, Writable.READ);
				params = {
					mapData: {
						searchEngines: mapData.searchEngines,
						name: normalizeMapName(mapData.name),
						description: mapData.description
					},
					isReadOnly: mapData.readId === req.params.mapSlug,
					url: `${baseUrl}${encodeURIComponent(req.params.mapSlug)}`
				};
			} catch (err: any) {
				if (err.status === 404) {
					res.status(404);
					params = {
						mapData: {
							searchEngines: false,
							name: undefined,
							description: undefined
						},
						isReadOnly: true,
						url: `${baseUrl}${encodeURIComponent(req.params.mapSlug)}`
					};
				} else {
					throw err;
				}
			}
		} else {
			params = {
				mapData: undefined,
				isReadOnly: true,
				url: baseUrl
			};
		}

		res.type("html");
		res.setHeader("Referrer-Policy", "origin");
		res.send(await renderMap(params));
	};

	const app = express();

	app.set("trust proxy", config.trustProxy ?? false);

	app.use(domainMiddleware);
	app.use(compression());
	app.use(cookieParser());

	app.use(i18nMiddleware);

	app.get("/", mapMiddleware);

	app.get(`${paths.base}manifest.json`, async (req, res) => {
		res.set("Content-type", "application/manifest+json");
		res.send(await getPwaManifest());
	});

	app.get(`${paths.base}opensearch.xml`, async (req, res) => {
		res.set("Content-type", "application/opensearchdescription+xml");
		res.send(await getOpensearchXml(getBaseUrl(req)));
	});

	app.get(`${paths.base}custom.css`, async (req, res, next) => {
		if (config.customCssFile) {
			res.sendFile(config.customCssFile);
		} else {
			next();
		}
	});

	app.use(`${paths.base}static/sw.js`, (req, res, next) => {
		res.setHeader("Service-Worker-Allowed", "/");
		next();
	});

	app.use(`${paths.base}oembed`, async (req, res, next) => {
		const query = z.object({
			url: z.string(),
			maxwidth: z.number().optional(),
			maxheight: z.number().optional(),
			format: z.string().optional()
		}).parse(req.query);

		if (query.format != null && query.format !== "json") {
			res.status(501).send();
			return;
		}

		const baseUrl = getBaseUrl(req);
		let mapData: MapDataWithWritable | undefined;
		if (query.url === baseUrl || `${query.url}/` === baseUrl) {
			mapData = undefined;
		} else {
			const parsed = parseMapUrl(query.url, baseUrl);
			if (parsed) {
				mapData = await database.maps.getMapDataBySlug(parsed.mapSlug, Writable.READ);
			} else {
				res.status(404).send();
				return;
			}
		}

		res.header("Content-type", "application/json");

		res.send(getOembedJson(baseUrl, mapData, query));
	});

	app.use(await getStaticFrontendMiddleware());

	app.use("/_api", getApiMiddleware(database));

	// If no file with this name has been found, we render a map
	app.get("/:mapSlug", mapMiddleware);

	app.get("/:mapSlug/gpx", async (req, res) => {
		const query = z.object({
			useTracks: z.enum(["0", "1"]).default("0"),
			filter: z.string().optional()
		}).parse(req.query);

		const mapData = await database.maps.getMapDataBySlug(req.params.mapSlug, Writable.READ);

		res.set("Content-type", "application/gpx+xml");
		res.attachment(`${getSafeFilename(normalizeMapName(mapData.name))}.gpx`);
		void exportGpx(database, mapData.id, query.useTracks == "1", query.filter).pipeTo(writableToWeb(res));
	});

	app.get("/:mapSlug/gpx/zip", async (req, res) => {
		const query = z.object({
			useTracks: z.enum(["0", "1"]).default("0"),
			filter: z.string().optional()
		}).parse(req.query);

		const mapData = await database.maps.getMapDataBySlug(req.params.mapSlug, Writable.READ);

		res.set("Content-type", "application/zip");
		res.attachment(mapData.name.replace(/[\\/:*?"<>|]+/g, '_') + ".zip");
		void exportGpxZip(database, mapData.id, query.useTracks == "1", query.filter).pipeTo(writableToWeb(res));
	});

	app.get("/:mapSlug/table", async (req, res) => {
		const query = z.object({
			filter: z.string().optional(),
			hide: z.string().optional()
		}).parse(req.query);
		const baseUrl = getBaseUrl(req);

		const mapData = await database.maps.getMapDataBySlug(req.params.mapSlug, Writable.READ);

		res.type("html");
		res.setHeader("Referrer-Policy", "origin");
		void createTable(
			database,
			mapData.id,
			query.filter,
			query.hide ? query.hide.split(',') : [],
			`${baseUrl}${encodeURIComponent(req.params.mapSlug)}/table`
		).pipeTo(writableToWeb(res));
	});

	app.get("/:mapSlug/rawTable/:typeId", async (req, res) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		const query = z.object({
			filter: z.string().optional(),
			hide: z.string().optional()
		}).parse(req.query);

		const mapData = await database.maps.getMapDataBySlug(req.params.mapSlug, Writable.READ);

		res.type("html");
		res.setHeader("Referrer-Policy", "origin");
		void createSingleTable(
			database,
			mapData.id,
			typeId,
			query.filter,
			query.hide ? query.hide.split(',') : []
		).pipeTo(writableToWeb(res));
	});

	app.get("/:mapSlug/geojson", async (req, res) => {
		const query = z.object({
			filter: z.string().optional()
		}).parse(req.query);

		const mapData = await database.maps.getMapDataBySlug(req.params.mapSlug, Writable.READ);

		res.set("Content-type", "application/geo+json");
		res.attachment(mapData.name.replace(/[\\/:*?"<>|]+/g, '_') + ".geojson");

		const result = exportGeoJson(database, mapData.id, query.filter);
		readableFromWeb(result).pipe(res);
	});

	app.get("/:mapSlug/csv/:typeId", async (req, res) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		const query = z.object({
			filter: z.string().optional(),
			hide: z.string().optional()
		}).parse(req.query);

		const mapData = await database.maps.getMapDataBySlug(req.params.mapSlug, Writable.READ);

		res.set("Content-type", "text/csv");
		res.attachment(mapData.name.replace(/[\\/:*?"<>|]+/g, '_') + ".csv");

		const result = exportCsv(
			database,
			mapData.id,
			typeId,
			query.filter,
			query.hide ? query.hide.split(',') : []
		);
		readableFromWeb(result).pipe(res);
	});

	const server = createServer(app);
	await new Promise<void>((resolve) => {
		server.listen({ port, host }, resolve);
	});
	return server;
}
