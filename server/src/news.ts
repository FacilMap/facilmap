import { getLastNewsModification, getNews, markdownBlock, markdownInline, quoteHtml } from "facilmap-utils"
import config from "./config"
import { asyncIteratorToStream } from "./utils/streams"
import { ReadableStream } from "stream/web";
import { paths } from "facilmap-frontend/build.js";
import { getI18n } from "./i18n";

const tagPrefix = "tag:facilmap.org,2026-10-09:";

export function getNewsAtom(baseUrl: string): ReadableStream<string> {
	return asyncIteratorToStream((async function* () {
		const news = getNews();
		const urlPrefix = `${baseUrl.replace(/\/$/, "")}${paths.base}`;
		const lang = getI18n().currentLanguage;

		yield (
			`<?xml version="1.0" encoding="utf-8"?>\n` +
			`<feed xmlns="http://www.w3.org/2005/Atom">\n` +
			`\t<id>${quoteHtml(`${tagPrefix}news-${quoteHtml(lang)}`)}</id>\n` +
			`\t<updated>${quoteHtml(getLastNewsModification())}</updated>\n` +
			`\t<title>${quoteHtml(config.appName)}</title>\n` +
			`\t<author>\n` +
			`\t\t<name>${quoteHtml(config.appName)}</name>\n` +
			`\t</author>\n` +
			`\t<link rel="self" href="${quoteHtml(`${urlPrefix}news.atom`)}" />\n` +
			`\t<icon>${quoteHtml(`${urlPrefix}favicon.svg`)}</icon>\n`
		);

		const dateTimes: Record<string, Date> = {};

		for (const n of news) {
			if (dateTimes[n.date]) {
				dateTimes[n.date] = new Date(dateTimes[n.date].getTime() + 1000);
			} else {
				dateTimes[n.date] = new Date(n.date);
			}

			yield (
				`\n` +
				`\t<entry>\n` +
				`\t\t<id>${quoteHtml(`${tagPrefix}news-${quoteHtml(lang)}-${quoteHtml(n.date)}-${quoteHtml(n.id)}`)}</id>\n` +
				`\t\t<updated>${quoteHtml(dateTimes[n.date].toISOString())}</updated>\n` +
				`\t\t<title type="html">${quoteHtml(markdownInline(n.heading, true))}</title>\n` +
				`\t\t<content type="html">${quoteHtml(markdownBlock(n.content, true))}</content>\n` +
				`\t</entry>\n`
			);
		}

		yield (
			`</feed>`
		);
	})());
}