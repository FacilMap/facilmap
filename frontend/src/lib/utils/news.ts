import { getI18n } from "./i18n";
import storage from "./storage";

export interface News {
	id: string;
	date: string;
	contentHtml: string;
}

export function getNews(): Record<number, [string, string]> {
	const i18n = getI18n();

	return {
		1: ["2026-03-30", i18n.t("news.news-1")],
		2: ["2026-04-09", i18n.t("news.news-2")],
		3: ["2026-04-09", i18n.t("news.news-3")],
		4: ["2026-04-14", i18n.t("news.news-4")],
		5: ["2026-04-14", i18n.t("news.news-5")],
		6: ["2026-04-30", i18n.t("news.news-6")],
		7: ["2026-04-30", i18n.t("news.news-7")],
		8: ["2026-05-10", i18n.t("news.news-8")],
		9: ["2026-06-10", i18n.t("news.news-9")],
		10: ["2026-06-29", i18n.t("news.news-10")],
		11: ["2026-06-30", i18n.t("news.news-11")]
	};
}

function getLastNewsId(): number {
	const ids = Object.keys(getNews());
	return Number(ids[ids.length - 1]);
}

export function shouldShowAboutDialog(): boolean {
	return storage.lastNews == null;
}

export function handleOpenAboutDialog(): void {
	if (storage.lastNews == null) {
		storage.lastNews = getLastNewsId();
	}
}

export function handleExpandNews(): void {
	storage.lastNews = getLastNewsId();
}

export function hasNews(): boolean {
	return storage.lastNews != null && storage.lastNews < getLastNewsId();
}