import { getI18n, newsNamespace } from "./i18n";
import storage from "./storage";
import newsJson from "../../news/news.json";

export interface News {
	id: string;
	date: string;
	heading: string;
	content: string;
	isNew: boolean;
}

export function getNews(lastNews = storage.lastNews): News[] {
	const i18n = getI18n();

	const news = newsJson.map((n) => ({
		id: n.id,
		date: n.date,
		heading: i18n.t(`news.${n.date}-${n.id}-heading`, { ns: newsNamespace }),
		content: i18n.t(`news.${n.date}-${n.id}-content`, { ns: newsNamespace })
	}));

	let lastReadIdx = lastNews && news.findIndex((n) => n.id === lastNews!.id);
	if (!lastReadIdx && lastNews) {
		// If last read news ID does not exist anymore (because it was deleted or its content and
		// thus ID was changed), fall back to resolution by date.
		lastReadIdx = news.findLastIndex((n) => n.date <= lastNews!.date);
	}

	return news.map((n, i) => ({
		...n,
		isNew: lastReadIdx == null || i > lastReadIdx
	}));
}

export function hasUnreadNews(lastNews = storage.lastNews): boolean {
	return !!lastNews && getNews(lastNews).some((n) => n.isNew);
}

function getLastNews(): { id: string; date: string } {
	return newsJson[newsJson.length - 1];
}

/**
 * Returns true if the about dialog should be shown when the app is opened without an open map.
 */
export function shouldShowAboutDialog(): boolean {
	// If storage.lastNews is undefined, the user has never seen the about dialog. In this case, we show it
	// the first time they open the app.
	return storage.lastNews == null;
}

export function handleOpenAboutDialog(): void {
	// If lastNews is undefined, the user has never seen the about dialog. Once they open it for the first time,
	// assume that this is their first time using the app, so we mark any news as read, so that only news that
	// are published after this point are highlighted.
	if (storage.lastNews == null) {
		storage.lastNews = getLastNews();
	}
}

export function handleExpandNews(): void {
	// When the news section of the about dialog is opened, we mark all news as read.
	storage.lastNews = getLastNews();
}