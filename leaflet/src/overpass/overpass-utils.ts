import { latLngBounds, LatLngBounds } from "leaflet";
import { getOverpassPresets, type OverpassPreset } from "./overpass-presets";

const OVERPASS_API = "https://overpass.kumi.systems/api/interpreter";

export interface OverpassElement {
	id: number;
	tags: Record<string, string>;
	type: "node" | "way" | "relation";
	lat: number;
	lon: number;
};

export function quoteOverpassString(str: string): string {
	return `"${str.replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;
}

export function getOverpassBbox(bbox: LatLngBounds): string {
	return [bbox.getSouth(), bbox.getWest(), bbox.getNorth(), bbox.getEast()].join(",");
}

export async function getOverpassElements(query: string | ReadonlyArray<Readonly<OverpassPreset>>, bbox: LatLngBounds, timeout: number, limit: number, signal?: AbortSignal): Promise<OverpassElement[]> {
	const normalizedQuery = typeof query == "string" ? `${query}${query[query.length - 1] == ";" ? "" : ";"}` : `(${query.map((q) => `${q.query};`).join("")});`;
	const data = `[out:json][timeout:${timeout}][bbox:${getOverpassBbox(bbox)}];${normalizedQuery}out center ${limit};`;

	const response = await fetch(`${OVERPASS_API}?data=${encodeURIComponent(data)}`, { signal });
	if (response.headers.get("Content-type")?.includes("text/html")) {
		const html = (new DOMParser()).parseFromString(await response.text(), "text/html");
		const errors = [...html.querySelectorAll("p")].flatMap((p) => (p.innerText.includes("Error") ? [p.innerText] : []));
		throw new Error(errors.join("\n"));
	}

	const result = await response.json();
	if (result.elements.length == 0 && result.remark)
		throw new Error(result.remark);

	return result.elements.map((element: any) => ({
		...element,
		tags: element.tags || {},
		...(element.center ? element.center : {})
	}));
}

export async function validateOverpassQuery(query: string, signal?: AbortSignal): Promise<string | undefined> {
	try {
		await getOverpassElements(query, latLngBounds([0, 0], [0, 0]), 1, 1, signal);
		return undefined;
	} catch (e: any) {
		return e.message;
	}
}

export function isOverpassQueryEmpty(query: string | ReadonlyArray<Readonly<OverpassPreset>> | undefined): boolean {
	return !query || (Array.isArray(query) && query.length == 0);
}

export function isEncodedOverpassQuery(shortQuery: string): boolean {
	return !!shortQuery && (shortQuery.substr(0, 2).toLowerCase() == "o_");
}

export function encodeOverpassQuery(query: string | ReadonlyArray<Readonly<OverpassPreset>> | undefined): string | undefined {
	if (isOverpassQueryEmpty(query))
		return undefined;
	else if (typeof query == "string")
		return `O_${btoa(query).replace(/\+/g, '.').replace(/\//g, '_').replace(/=+$/g, '')}`;
	else
		return `o_${query!.map((q) => q.key).join("_")}`;
}

export function decodeOverpassQuery(shortQuery: string | undefined): string | OverpassPreset[] | undefined {
	if (!shortQuery)
		return undefined;
	else if (shortQuery.startsWith("o_"))
		return getOverpassPresets(shortQuery.substr(2).split("_"));
	else if (shortQuery.startsWith("O_"))
		return atob(shortQuery.substr(2)).replace(/\./g, '+').replace(/_/g, '/');
}