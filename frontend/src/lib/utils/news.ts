import { getI18n } from "./i18n";
import storage from "./storage";

export function getNews(): Record<number, [string, string]> {
	const i18n = getI18n();

	return {
		1: ["2026-03-30", i18n.t("news.news-1")],
		2: ["2026-04-09", i18n.t("news.news-2")],
		3: ["2026-04-09", i18n.t("news.news-3")],
		4: ["2026-04-14", i18n.t("news.news-4")],
		5: ["2026-04-14", i18n.t("news.news-5")]
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