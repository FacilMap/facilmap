import type { ID, Type, View } from "facilmap-types";
import { getI18n } from "./i18n.js";

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LENGTH = 12;

export function generateRandomPadId(length: number = LENGTH): string {
	let randomPadId = "";
	for(let i=0; i<length; i++) {
		randomPadId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
	}
	return randomPadId;
}

export function normalizePadName(name: string | undefined): string {
	return name || getI18n().t("pads.unnamed-map");
}

export function normalizePageTitle(padName: string | undefined, appName: string): string {
	return padName ? getI18n().t("pads.page-title", { padName, appName }) : appName;
}

export function normalizePageDescription(padDescription: string | undefined): string {
	return padDescription || getI18n().t("pads.fallback-page-description");
}

export function getOrderedTypes(types: Type[] | Record<ID, Type>): Type[] {
	const typeArr = Array.isArray(types) ? [...types] : Object.values(types);
	return typeArr.sort((a, b) => a.idx - b.idx);
}

export function getOrderedViews(views: View[] | Record<ID, View>): View[] {
	const typeArr = Array.isArray(views) ? [...views] : Object.values(views);
	return typeArr.sort((a, b) => a.idx - b.idx);
}