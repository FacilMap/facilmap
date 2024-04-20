import type { ID, Type, View } from "facilmap-types";
import { getI18n } from "./i18n.js";

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LENGTH = 12;

export function generateRandomMapId(length: number = LENGTH): string {
	let randomMapId = "";
	for(let i=0; i<length; i++) {
		randomMapId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
	}
	return randomMapId;
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

export function getOrderedTypes(types: Type[] | Record<ID, Type>): Type[] {
	const typeArr = Array.isArray(types) ? [...types] : Object.values(types);
	return typeArr.sort((a, b) => a.idx - b.idx);
}

export function getOrderedViews(views: View[] | Record<ID, View>): View[] {
	const typeArr = Array.isArray(views) ? [...views] : Object.values(views);
	return typeArr.sort((a, b) => a.idx - b.idx);
}