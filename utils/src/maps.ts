import { Writable, type DeepReadonly, type DistributivePick, type ID, type MapData, type MapDataWithWritable, type MapSlug, type Type, type View } from "facilmap-types";
import { getI18n } from "./i18n.js";

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LENGTH = 12;

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

export function getWritable(mapData: MapDataWithWritable | MapData, mapSlug: MapSlug): Writable {
	if ("adminId" in mapData && mapData.adminId === mapSlug) {
		return Writable.ADMIN;
	} else if ("writeId" in mapData && mapData.writeId === mapSlug) {
		return Writable.WRITE;
	} else {
		return Writable.READ;
	}
}

export function getMapSlug(mapData: DistributivePick<MapDataWithWritable, "writable" | "adminId" | "writeId" | "readId">): MapSlug {
	return mapData.writable === Writable.ADMIN ? mapData.adminId : mapData.writable === Writable.WRITE ? mapData.writeId : mapData.readId;
}

export function getMapDataWithWritable(mapData: MapData, writable: Writable): MapDataWithWritable {
	const { adminId, writeId, ...rest } = mapData;
	if (writable === Writable.ADMIN) {
		return { ...rest, adminId, writeId, writable };
	} else if (writable === Writable.WRITE) {
		return { ...rest, writeId, writable };
	} else {
		return { ...rest, writable };
	}
}