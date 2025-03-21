import { getI18n } from "./i18n";
import type { CustomLink } from "./storage";
import storage from "./storage";
import { cloneDeep, orderBy } from "lodash-es";

export type PresetLink = CustomLink & { id: string; enabled: boolean; commercial?: true };

export const DEFAULT_LINKS: PresetLink[] = [
	{
		id: "geo",
		get label(): string { return getI18n().t("links.geo-link"); },
		map: "",
		marker: "geo:%LAT%,%LON%?z=%ZOOM%",
		enabled: true
	},
	{
		id: "osm",
		get label(): string { return getI18n().t("links.openstreetmap"); },
		map: "https://www.openstreetmap.org/#map=%ZOOM%/%LAT%/%LON%",
		marker: "https://www.openstreetmap.org/?mlat=%LAT%&mlon=%LON%#map=%ZOOM%/%LAT%/%LON%",
		enabled: true
	},
	{
		id: "osme",
		get label(): string { return getI18n().t("links.openstreetmap-editor"); },
		map: "https://www.openstreetmap.org/edit#map=%ZOOM%/%LAT%/%LON%",
		marker: "",
		enabled: false,
	},
	{
		id: "gmaps",
		get label(): string { return getI18n().t("links.google-maps"); },
		map: "https://www.google.com/maps/@?api=1&map_action=map&center=%LAT%,%LON%&zoom=%ZOOM%",
		marker: "https://maps.google.com/maps?t=m&q=loc:%LAT%,%LON%",
		enabled: true,
		commercial: true
	},
	{
		id: "gmaps-s",
		get label(): string { return getI18n().t("links.google-maps-satellite"); },
		map: "https://www.google.com/maps/@?api=1&map_action=map&center=%LAT%,%LON%&zoom=%ZOOM%&basemap=satellite",
		marker: "https://maps.google.com/maps?t=k&q=loc:%LAT%,%LON%",
		enabled: true,
		commercial: true
	},
	{
		id: "bing",
		get label(): string { return getI18n().t("links.bing-maps"); },
		map: "https://www.bing.com/maps?cp=%LAT%~%LON%&lvl=%ZOOM%",
		marker: "https://www.bing.com/maps?q=%LAT%,%LON%",
		enabled: true,
		commercial: true
	},
	{
		id: "bing-s",
		get label(): string { return getI18n().t("links.bing-maps-satellite"); },
		map: "https://www.bing.com/maps?cp=%LAT%~%LON%&lvl=%ZOOM%&style=h",
		marker: "https://www.bing.com/maps?q=%LAT%,%LON%&style=h",
		enabled: true,
		commercial: true
	},
	{
		id: "Mapy.cz",
		get label(): string { return getI18n().t("links.mapy-cz"); },
		map: "https://en.mapy.cz/zakladni?x=%LON%&y=%LAT%&z=%ZOOM%",
		marker: "https://en.mapy.cz/zakladni?q=%LAT%,%LON%&x=%LON%&y=%LAT%&z=%ZOOM%",
		enabled: false,
		commercial: true
	},
	{
		id: "p4n",
		get label(): string { return getI18n().t("links.park4night"); },
		get map(): string { return `https://park4night.com/${["fr", "de", "es", "it", "nl"].find((l) => l === getI18n().currentLanguage) ?? "en"}/search?lat=%LAT%&lng=%LON%&z=%ZOOM%`; },
		marker: "",
		enabled: false,
		commercial: true
	}
];

export type ExternalLinkSetting = (PresetLink | CustomLink) & { key: string };

export function getExternalLinksSetting(): ExternalLinkSetting[] {
	const result: ExternalLinkSetting[] = storage.customLinks ? storage.customLinks.map((l, idx) => ({ ...l, key: `custom-${idx}` })) : [];
	for (const { l, idx } of orderBy(DEFAULT_LINKS.map((l, idx) => ({ l, idx: storage.presetLinks?.[l.id]?.idx ?? idx })), "idx", "asc")) {
		result.splice(idx, 0, {
			...l,
			key: l.id,
			enabled: storage.presetLinks?.[l.id]?.enabled ?? l.enabled
		});
	}
	return result;
}

export function isPresetLink(link: ExternalLinkSetting): link is PresetLink & { key: string } {
	return "id" in link;
}

export function setExternalLinksSetting(links: ExternalLinkSetting[]): void {
	storage.presetLinks = Object.fromEntries(links.flatMap((l, idx) => {
		if (isPresetLink(l)) {
			const i = DEFAULT_LINKS.findIndex((l2) => l2.id === l.id);
			if (i !== -1) {
				const v = {
					...(l.enabled !== DEFAULT_LINKS[i].enabled ? { enabled: l.enabled } : {}),
					...(idx !== i ? { idx } : {})
				};
				if (Object.keys(v).length > 0) {
					return [[l.id, v]];
				}
			}
		}
		return [];
	}));
	storage.customLinks = cloneDeep(links.filter((l) => !isPresetLink(l)));
}

export type ExternalLink = {
	key: string;
	label: string;
	href: string;
	target: string;
};

export function getExternalLinks(data: { lat: number; lon: number; zoom?: number }, type: "map" | "marker", hideCommercial: boolean): ExternalLink[] {
	const lat = data.lat.toFixed(5);
	const lon = data.lon.toFixed(5);
	const zoom = `${data.zoom ?? 12}`;

	return getExternalLinksSetting().flatMap((l) => {
		const url = l[type].trim();
		if (url === "" || (isPresetLink(l) && (!l.enabled || (hideCommercial && l.commercial)))) {
			return [];
		}

		return [{
			key: l.key,
			label: l.label,
			href: url.replaceAll("%LAT%", lat).replaceAll("%LON%", lon).replaceAll("%ZOOM%", zoom),
			target: url.startsWith("geo:") ? "" : "_blank"
		}];
	});
}