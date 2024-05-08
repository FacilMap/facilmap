import type { SearchResult } from "facilmap-types";
import config from "./config.js";
import { find as findSearch, parseUrlQuery } from "facilmap-utils";
import { getDomainLang, getI18n } from "./i18n.js";
import { decompressStreamIfApplicable, peekFirstBytes, writableToWeb } from "./utils/streams.js";
import { Writable } from "stream";
import sax from "sax";
import JSONStream from "JSONStream";
import { loadSubRelations } from "./osm.js";

export async function find<LoadUrls extends boolean = false>(query: string, loadUrls?: LoadUrls): Promise<Array<SearchResult> | (LoadUrls extends true ? { data: ReadableStream<string> } : never)> {
	if (loadUrls) {
		const url = parseUrlQuery(query);
		if (url) {
			return await _loadUrl(url) as LoadUrls extends true ? { data: ReadableStream<string> } : never;
		}
	}

	const lang = getDomainLang();

	return await findSearch(query, {
		lang: lang?.isExplicit ? lang.i18n.languages.join(",") : lang?.acceptLanguage
	});
}

export async function findQuery(query: string): Promise<SearchResult[]> {
	const lang = getDomainLang();

	return await findSearch(query, {
		lang: lang?.isExplicit ? lang.i18n.languages.join(",") : lang?.acceptLanguage
	});
}

export async function findUrl(url: string): Promise<{ data: ReadableStream<string> }> {
	if (!url.match(/^https?:\/\//)) {
		throw new Error(getI18n().t("search.invalid-url-error"));
	}

	return await _loadUrl(url);
}

async function _loadUrl(url: string): Promise<{ type?: string; data: ReadableStream<string> }> {
	const res = await fetch(
		url,
		{
			headers: {
				"User-Agent": config.userAgent
			}
		}
	);

	if (!res.ok) {
		throw new Error(getI18n().t("search.url-request-error", { url, status: res.status }));
	}

	const type = res.headers.get("Content-type") ?? undefined;

	let bodyStream = res.body!
		.pipeThrough(decompressStreamIfApplicable())
		.pipeThrough(new TextDecoderStream());

	if (url.match(/^https?:\/\/www\.freietonne\.de\/seekarte\/getOpenLayerPois\.php\?/)) {
		return { type, data: bodyStream };
	}

	const peek = peekFirstBytes(
		(chunks: string[]) => {
			const text = chunks.join("");
			if (text.match(/^\s*$/)) {
				return undefined;
			} else if(text.match(/^\s*</)) {
				return "xml";
			} else if(text.match(/^\s*\{/)) {
				return "json";
			} else {
				return "";
			}
		}
	);
	bodyStream = bodyStream.pipeThrough(peek);
	const result = await peek.result;

	if (result === "xml") {
		const parser = sax.createStream(false);

		const rootTagP = new Promise<string | undefined>((resolve, reject) => {
			parser.once("opentag", (node) => {
				resolve(node.name);
			});
			parser.once("error", (err) => {
				reject(err);
			});
			parser.once("end", () => {
				resolve(undefined);
			});
		});

		let peek;
		[bodyStream, peek] = bodyStream.tee();
		const abortPeek = new AbortController();
		peek.pipeTo(writableToWeb(parser), { signal: abortPeek.signal }).catch((err) => {
			if (err.name !== "AbortError") {
				throw err;
			}
		});
		const rootTag = await rootTagP;

		if(rootTag === "OSM" && url.startsWith("https://api.openstreetmap.org/api/")) {
			abortPeek.abort();
			return { type, data: bodyStream.pipeThrough(loadSubRelations()) };
		} else if ((["GPX", "KML", "OSM"] as any[]).includes(rootTag)) {
			abortPeek.abort();
			return { type, data: bodyStream };
		} else {
			void bodyStream.cancel();
			abortPeek.abort();
			throw new Error(getI18n().t("search.url-unknown-format-error"));
		}
	} else if (result === "json") {
		// Rudimentarily check whether the file is GeoJSON by checking whether there is a "type" root property.
		let peek;
		[bodyStream, peek] = bodyStream.tee();
		const parse = JSONStream.parse([{ emitKey: true }]);
		const isGeoJsonP = new Promise<boolean>((resolve, reject) => {
			// TODO: Limit
			parse.once("data", (data: any) => {
				if (data.key === "type") {
					void peek.cancel();
					resolve(true);
				}
			});
			parse.once("error", (err: any) => {
				reject(err);
			});
			parse.once("end", () => {
				resolve(false);
			});
		});
		void peek.pipeTo(writableToWeb(parse));
		const isGeoJson = await isGeoJsonP;
		if (isGeoJson) {
			return { type, data: bodyStream };
		} else {
			throw new Error(getI18n().t("search.url-unknown-format-error"));
		}
	} else {
		void bodyStream.cancel();
		throw new Error(getI18n().t("search.url-unknown-format-error"));
	}
}

