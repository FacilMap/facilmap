import compression from "compression";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import { createServer, type Server as HttpServer } from "http";
import { ApiVersion, type MapData, type Stripped } from "facilmap-types";
import { createTable } from "./export/table.js";
import Database from "./database/database";
import domainMiddleware from "express-domain-middleware";
import { getOembedJson, getOpensearchXml, getPwaManifest, getStaticFrontendMiddleware, renderMap, type RenderMapParams } from "./frontend";
import { normalizeMapName, parseMapUrl } from "facilmap-utils";
import { paths } from "facilmap-frontend/build.js";
import config from "./config";
import * as z from "zod";
import cookieParser from "cookie-parser";
import { i18nMiddleware } from "./i18n.js";
import { getApiMiddleware } from "./api/api.js";
import { writableToWeb } from "./utils/streams.js";
import finalhandler from "finalhandler";
import { ApiV3Backend } from "./api/api-v3.js";

function getBaseUrl(req: Request): string {
	return config.baseUrl ?? `${req.protocol}://${req.host}/`;
}

export async function initWebserver(database: Database, port: number, host?: string): Promise<HttpServer> {
	const mapMiddleware = async (req: Request<{ mapSlug: string }>, res: Response<string>) => {
		const baseUrl = getBaseUrl(req);

		let params: RenderMapParams;
		if(req.params?.mapSlug) {
			try {
				const api = new ApiV3Backend(database, req.ip);
				const { mapData, activeLink } = await api.resolveMapSlug(req.params.mapSlug);
				params = {
					mapData: {
						searchEngines: activeLink.searchEngines,
						name: normalizeMapName(mapData.name),
						description: mapData.description
					},
					url: `${baseUrl}${encodeURIComponent(req.params.mapSlug)}`
				};
			} catch (err: any) {
				if (err.status === 401 || err.status === 404) {
					if (err.status === 404) {
						res.status(404);
					}
					params = {
						mapData: {
							searchEngines: false,
							name: undefined,
							description: undefined
						},
						url: `${baseUrl}${encodeURIComponent(req.params.mapSlug)}`
					};
				} else {
					throw err;
				}
			}
		} else {
			params = {
				mapData: undefined,
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

		const api = new ApiV3Backend(database, req.ip);

		const baseUrl = getBaseUrl(req);
		let mapData: Stripped<MapData> | undefined;
		if (query.url === baseUrl || `${query.url}/` === baseUrl) {
			mapData = undefined;
		} else {
			const parsed = parseMapUrl(query.url, baseUrl);
			if (parsed) {
				mapData = await api.getMap(parsed.mapSlug);
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

	// Legacy GPX export URL
	app.get("/:mapSlug/gpx", async (req, res) => {
		const query = z.object({
			useTracks: z.enum(["0", "1"]).default("0"),
			filter: z.string().optional()
		}).parse(req.query);

		res.redirect(`../_api/${ApiVersion.V3}/map/${encodeURIComponent(req.params.mapSlug)}/gpx?${new URLSearchParams({
			...query.useTracks !== "1" ? { rte: "true" } : {},
			...query.filter ? { filter: query.filter } : {}
		})}`);
	});

	// Legacy GPX-ZIP export URL
	app.get("/:mapSlug/gpx/zip", async (req, res) => {
		const query = z.object({
			useTracks: z.enum(["0", "1"]).default("0"),
			filter: z.string().optional()
		}).parse(req.query);

		res.redirect(`../_api/${ApiVersion.V3}/map/${encodeURIComponent(req.params.mapSlug)}/gpx/zip?${new URLSearchParams({
			...query.useTracks !== "1" ? { rte: "true" } : {},
			...query.filter ? { filter: query.filter } : {}
		})}`);
	});

	app.get("/:mapSlug/table", async (req, res) => {
		const query = z.object({
			filter: z.string().optional(),
			hide: z.string().optional()
		}).parse(req.query);
		const baseUrl = getBaseUrl(req);

		const api = new ApiV3Backend(database, req.ip);
		const { activeLink } = await api.resolveMapSlug(req.params.mapSlug);

		res.type("html");
		res.setHeader("Referrer-Policy", "origin");
		void createTable(
			api,
			activeLink,
			query.filter,
			query.hide ? query.hide.split(',') : [],
			`${baseUrl}${encodeURIComponent(req.params.mapSlug)}/table`
		).pipeTo(writableToWeb(res));
	});

	// Legacy table export URL
	app.get("/:mapSlug/rawTable/:typeId", async (req, res) => {
		const query = z.object({
			filter: z.string().optional(),
			hide: z.string().optional()
		}).parse(req.query);

		res.redirect(`../_api/${ApiVersion.V3}/map/${encodeURIComponent(req.params.mapSlug)}/table?${new URLSearchParams({
			typeId: req.params.typeId,
			...query.filter ? { filter: query.filter } : {},
			...query.hide ? { hide: query.hide } : {}
		})}`);
	});

	app.get("/:mapSlug/geojson", async (req, res) => {
		const query = z.object({
			filter: z.string().optional()
		}).parse(req.query);

		res.redirect(`../_api/${ApiVersion.V3}/map/${encodeURIComponent(req.params.mapSlug)}/geojson?${new URLSearchParams({
			...query.filter ? { filter: query.filter } : {}
		})}`);
	});

	app.get("/:mapSlug/csv/:typeId", async (req, res) => {
		const query = z.object({
			filter: z.string().optional(),
			hide: z.string().optional()
		}).parse(req.query);

		res.redirect(`../_api/${ApiVersion.V3}/map/${encodeURIComponent(req.params.mapSlug)}/csv?${new URLSearchParams({
			typeId: req.params.typeId,
			...query.filter ? { filter: query.filter } : {},
			...query.hide ? { hide: query.hide } : {}
		})}`);
	});

	// Log errors with details, see https://github.com/expressjs/express/issues/6462
	app.use(((err, req, res, next) => {
		finalhandler(req, res, {
			env: app.get("env"),
			onerror: (err) => { console.error(err); }
		})(err);
	}) satisfies ErrorRequestHandler);

	const server = createServer(app);
	await new Promise<void>((resolve) => {
		server.listen({ port, host }, resolve);
	});
	return server;
}