import { getI18n, newsNamespace } from "../i18n";
import { DEFAULT_LANGUAGE, getRawI18n } from "../i18n-utils";
import newsJson from "./news.json";
import newsMtimes from "virtual:news-mtimes";

export interface News {
	id: string;
	date: string;
	heading: string;
	content: string;
}

export function getNews(): News[] {
	const i18n = getI18n();

	return newsJson.map((n) => ({
		id: n.id,
		date: n.date,
		heading: i18n.t(`news.${n.date}-${n.id}-heading`, { ns: newsNamespace }),
		content: i18n.t(`news.${n.date}-${n.id}-content`, { ns: newsNamespace })
	}));
}

export function getLastNews(): { id: string; date: string } {
	return newsJson[newsJson.length - 1];
}

export function getLastNewsModification(): string {
	const dates = [
		newsMtimes.news,
		newsMtimes.i18n[DEFAULT_LANGUAGE],
		newsMtimes.i18n[getRawI18n().language]
	].flatMap((d) => d == null ? [] : [new Date(d).getTime()]);
	return new Date(Math.max(...dates)).toISOString();
}