import { ADMIN_LINK_COMMENT, CRU, READ_LINK_COMMENT, WRITE_LINK_COMMENT, type DeepReadonly, type ID, type MapLink, type MapSlug, type Type, type View } from "facilmap-types";
import { getI18n } from "./i18n.js";

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LENGTH = 16;

export function generateRandomMapSlug(length: number = LENGTH): MapSlug {
	let randomMapSlug = "";
	for(let i=0; i<length; i++) {
		randomMapSlug += LETTERS[Math.floor(Math.random() * LETTERS.length)];
	}
	return randomMapSlug;
}

export function normalizeMapName(name: string | undefined): string {
	return name || getI18n().t("maps.unnamed-map");
}

export function normalizePageTitle(mapName: string | undefined, appName: string): string {
	return mapName ? getI18n().t("maps.page-title", { mapName, appName }) : appName;
}

export function normalizePageDescription(mapDescription: string | undefined): string {
	return mapDescription || getI18n().t("maps.fallback-page-description");
}

export function getOrderedTypes(types: Array<DeepReadonly<Type>> | Record<ID, DeepReadonly<Type>> | undefined): Array<DeepReadonly<Type>> {
	const typeArr = !types ? [] : Array.isArray(types) ? [...types] : Object.values(types);
	return typeArr.sort((a, b) => a.idx - b.idx);
}

export function getOrderedViews(views: Array<DeepReadonly<View>> | Record<ID, DeepReadonly<View>> | undefined): Array<DeepReadonly<View>> {
	const viewArr = !views ? [] : Array.isArray(views) ? [...views] : Object.values(views);
	return viewArr.sort((a, b) => a.idx - b.idx);
}

export function i18nMapLinkComments<T extends DeepReadonly<MapLink<CRU>>>(links: ReadonlyArray<T>): T[] {
	const i18n = getI18n();
	return links.map((link) => ({
		...link,
		comment: (
			link.comment === ADMIN_LINK_COMMENT ? i18n.t("maps.admin-link-comment") :
			link.comment === WRITE_LINK_COMMENT ? i18n.t("maps.write-link-comment") :
			link.comment === READ_LINK_COMMENT ? i18n.t("maps.read-link-comment") :
			link.comment
		)
	}));
}

export function deI18nMapLinkComments<T extends DeepReadonly<MapLink<CRU>>>(links: ReadonlyArray<T>): T[] {
	const i18n = getI18n();
	return links.map((link) => ({
		...link,
		comment: (
			link.comment === i18n.t("maps.admin-link-comment") ? ADMIN_LINK_COMMENT :
			link.comment === i18n.t("maps.write-link-comment") ? WRITE_LINK_COMMENT :
			link.comment === i18n.t("maps.read-link-comment") ? READ_LINK_COMMENT :
			link.comment
		)
	}));
}