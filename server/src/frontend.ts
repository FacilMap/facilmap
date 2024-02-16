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

export const isDevMode = !!process.env.FM_DEV;

async function getManifest(): Promise<Manifest> {
	const manifest = await readFile(paths.manifest);
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
		const manifest = await getManifest();

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
		config: {
			limaLabsToken: config.limaLabsToken
		} satisfies InjectedConfig,
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