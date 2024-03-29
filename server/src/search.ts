import { load, type CheerioAPI } from "cheerio";
import compressjs from "compressjs";
import zlib from "zlib";
import util from "util";
import type { SearchResult } from "facilmap-types";
import stripBomBuf from "strip-bom-buf";
import config from "./config.js";
import { find as findSearch, parseUrlQuery } from "facilmap-utils";

export async function find(query: string, loadUrls = false): Promise<Array<SearchResult> | string> {
	if (loadUrls) {
		const url = parseUrlQuery(query);
		if (url) {
			return await _loadUrl(url);
		}
	}

	return await findSearch(query);
}

async function _loadUrl(url: string): Promise<string> {
	const res = await fetch(
		url,
		{
			headers: {
				"User-Agent": config.userAgent
			}
		}
	);

	if (!res.ok) {
		throw new Error(`Request to "${url}" failed with status ${res.status}.`);
	}

	let bodyBuf = new Uint8Array(await res.arrayBuffer());

	if(!bodyBuf)
		throw new Error("Invalid response from server.");

	if(bodyBuf[0] == 0x42 && bodyBuf[1] == 0x5a && bodyBuf[2] == 0x68) {// bzip2
		bodyBuf = Buffer.from(compressjs.Bzip2.decompressFile(Buffer.from(bodyBuf)));
	}
	else if(bodyBuf[0] == 0x1f && bodyBuf[1] == 0x8b && bodyBuf[2] == 0x08) // gzip
		bodyBuf = await util.promisify(zlib.gunzip.bind(zlib))(bodyBuf);

	const body = new TextDecoder().decode(stripBomBuf(bodyBuf));

	if(url.match(/^https?:\/\/www\.freietonne\.de\/seekarte\/getOpenLayerPois\.php\?/))
		return body;
	else if(body.match(/^\s*</)) {
		const $ = load(body, { xmlMode: true });
		const rootEl = $.root().children();

		if(rootEl.is("osm") && url.startsWith("https://api.openstreetmap.org/api/")) {
			await _loadSubRelations($);
			return $.xml();
		} else if(rootEl.is("gpx,kml,osm"))
			return body;
		else
			throw new Error("Unknown file format.");
	} else if(body.match(/^\s*\{/)) {
		const content = JSON.parse(body);
		if(content.type)
			return body;
		else
			throw new Error("Unknown file format.");
	} else {
		throw new Error("Unknown file format.");
	}
}

async function _loadSubRelations($: CheerioAPI) {
	const loadedIds = new Set<string>();

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const promises: Array<Promise<string>> = [ ];

		$("member[type='relation']").each(function() {
			const relId = $(this).attr("ref")!;
			if(!loadedIds.has(relId)) {
				$(this).remove(); // Remove relation from result, as it will be returned again as part of the sub request
				promises.push(fetch(
					"https://api.openstreetmap.org/api/0.6/relation/" + relId + "/full",
					{
						headers: {
							"User-Agent": config.userAgent
						}
					}
				).then((res) => res.text()));
				loadedIds.add(relId);
			}
		});

		if (promises.length == 0)
			return;

		if(promises.length > 0) {
			const relations = await Promise.all(promises);

			for (const relation of relations) {
				$.root().children().append(load(relation, { xmlMode: true }).root().children().children());
			}
		}
	}
}
