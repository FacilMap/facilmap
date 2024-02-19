import type { Manifest } from "vite";
import { paths, serve } from "facilmap-frontend/build.js";
import { readFile } from "node:fs/promises";
import type { ID, Line, Marker, PadData, Type } from "facilmap-types";
import * as ejs from "ejs";
import * as utils from "facilmap-utils";
import { Router, type RequestHandler } from "express";
import { static as expressStatic } from "express";
import { normalizeLineName, normalizeMarkerName, normalizePadName, type InjectedConfig } from "facilmap-utils";
import config from "./config";
import { asyncIteratorToArray, jsonStream } from "./utils/streams";

export const isDevMode = !!process.env.FM_DEV;

async function getViteManifest(): Promise<Manifest> {
	const manifest = await readFile(paths.viteManifest);
	return JSON.parse(manifest.toString());
}

interface Scripts {
	scripts: string[];
	preloadScripts: string[];
	styles: string[];
}

export type TypeWithObjects = Type & {
	markers: Marker[];
	lines: Line[];
}

async function getScripts(entry: "mapEntry" | "tableEntry"): Promise<Scripts> {
	if (isDevMode) {
		return {
			scripts: ["@vite/client", paths[entry]],
			preloadScripts: [],
			styles: []
		};
	} else {
		const manifest = await getViteManifest();

		let referencedChunks = [paths[entry]];
		for (let i = 0; i < referencedChunks.length; i++) {
			const chunk = manifest[referencedChunks[i]];
			for (const reference of [
				...chunk.imports ?? [],
				...chunk.dynamicImports ?? []
			]) {
				if (!referencedChunks.includes(reference)) {
					referencedChunks.push(reference);
				}
			}
		}

		const scripts = referencedChunks.map((c) => manifest[c].file);
		const styles = referencedChunks.map((c) => manifest[c].css ?? []);

		return {
			scripts: scripts.slice(0, 1),
			preloadScripts: scripts.slice(1),
			styles: styles.flat()
		};
	}
}

function getInjectedConfig(): InjectedConfig {
	return {
		appName: config.appName,
		limaLabsToken: config.limaLabsToken,
		hideCommercialMapLinks: config.hideCommercialMapLinks,
	};
}

export interface RenderMapParams {
	padData: Pick<PadData, "name" | "description" | "searchEngines"> | undefined;
	isReadOnly: boolean;
}

export async function renderMap(params: RenderMapParams): Promise<string> {
	const [template, injections] = await Promise.all([
		readFile(paths.mapEjs).then((t) => t.toString()),
		getScripts("mapEntry")
	]);

	return ejs.render(template, {
		appName: config.appName,
		config: getInjectedConfig(),
		...injections,
		paths,
		...params
	});
}

export async function renderTable(params: {
	padData: PadData | undefined;
	types: Record<ID, TypeWithObjects>;
	hide: string[];
}): Promise<string> {
	const [template, injections] = await Promise.all([
		readFile(paths.tableEjs).then((t) => t.toString()),
		getScripts("tableEntry")
	]);

	return ejs.render(template, {
		...injections,
		appName: config.appName,
		paths,
		utils,
		normalizeMarkerName,
		normalizeLineName,
		normalizePadName,
		...params
	});
}

export async function getStaticFrontendMiddleware(): Promise<RequestHandler> {
	if (isDevMode) {
		const devServer = await serve({
			server: {
				middlewareMode: true
			},
			appType: "custom"
		});

		return devServer.middlewares;
	} else {
		const router = Router();
		router.use(`${paths.base}assets/`, (req, res, next) => {
			res.setHeader('Cache-Control', 'public, max-age=315576000, immutable'); // 10 years
			next();
		});
		router.use(paths.base, expressStatic(paths.dist));
		return router;
	}
}

export async function getPwaManifest(): Promise<string> {
	const template = await readFile(paths.pwaManifest).then((t) => t.toString());
	const chunks = await asyncIteratorToArray(jsonStream(JSON.parse(template), {
		APP_NAME: config.appName
	}));
	return chunks.join("");
}

export async function getOpensearchXml(baseUrl: string): Promise<string> {
	const template = await readFile(paths.opensearchXmlEjs).then((t) => t.toString());

	return ejs.render(template, {
		appName: config.appName,
		baseUrl
	});
}