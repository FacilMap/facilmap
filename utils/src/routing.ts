import type { RouteMode } from "facilmap-types";
import { getI18n } from "./i18n.js";
import { quoteRegExp } from "./utils.js";

export interface DecodedRouteMode {
	mode: "" | "car" | "bicycle" | "pedestrian" | "track";
	type: "" | "hgv" | "road" | "mountain" | "electric" | "hiking" | "wheelchair";
	preference: "fastest" | "shortest";
	details: boolean;
	avoid: Array<"highways" | "tollways" | "ferries" | "fords" | "steps">;
}

export const R = 6371; // km

/**
 * Returns the distance of the given path in kilometers.
 */
export function calculateDistance(posList: ReadonlyArray<{ readonly lat: number; readonly lon: number; }>): number {
	// From http://stackoverflow.com/a/365853/242365
	let ret = 0;

	for (let i = 1; i < posList.length; i++) {
		const lat1 = posList[i - 1].lat * Math.PI / 180;
		const lon1 = posList[i - 1].lon * Math.PI / 180;
		const lat2 = posList[i].lat * Math.PI / 180;
		const lon2 = posList[i].lon * Math.PI / 180;
		const dLat = lat2 - lat1;
		const dLon = lon2 - lon1;

		const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		ret += R * c;
	}

	return ret;
}

export function encodeRouteMode(decodedMode: DecodedRouteMode): string {
	const encodedMode = [];

	if(decodedMode) {
		if(decodedMode.mode)
			encodedMode.push(decodedMode.mode);
		if(decodedMode.type)
			encodedMode.push(decodedMode.type);
		if(decodedMode.preference && decodedMode.preference != "fastest")
			encodedMode.push(decodedMode.preference);
		if(decodedMode.details)
			encodedMode.push("details");
		if(decodedMode.avoid && decodedMode.avoid.length > 0)
			encodedMode.push("avoid", ...decodedMode.avoid);
	}

	return encodedMode.join(" ");
}

export function decodeRouteMode(encodedMode: RouteMode | undefined): DecodedRouteMode {
	const decodedMode: DecodedRouteMode = {
		mode: "",
		type: "",
		preference: "fastest",
		details: false,
		avoid: []
	};

	if(encodedMode) {
		for(const part of encodedMode.split(/\s+/)) {
			if(["car", "bicycle", "pedestrian", "track"].includes(part))
				decodedMode.mode = part as any;
			else if(["hgv", "road", "mountain", "electric", "hiking", "wheelchair"].includes(part))
				decodedMode.type = part as any;
			else if (part == "recommended")
				decodedMode.preference = "fastest";
			else if(["fastest", "shortest"].includes(part))
				decodedMode.preference = part as any;
			else if(part == "details")
				decodedMode.details = true;
			else if(["highways", "tollways", "ferries", "fords", "steps"].includes(part))
				decodedMode.avoid.push(part as any);
		}
	}

	return decodedMode;
}

export function formatRouteMode(encodedMode: RouteMode): string {
	const decodedMode = decodeRouteMode(encodedMode);

	switch(decodedMode.mode) {
		case "car":
			switch(decodedMode.type) {
				case "hgv":
					return getI18n().t("routing.format-by-hgv");
				default:
					return getI18n().t("routing.format-by-car");
			}
		case "bicycle":
			switch(decodedMode.type) {
				case "road":
					return getI18n().t("routing.format-by-road-bike");
				case "mountain":
					return getI18n().t("routing.format-by-mountain-bike");
				case "electric":
					return getI18n().t("routing.format-by-electric-bike");
				default:
					return getI18n().t("routing.format-by-bicycle");
			}
		case "pedestrian":
			switch(decodedMode.type) {
				case "wheelchair":
					return getI18n().t("routing.format-by-wheelchair");
				default:
					return getI18n().t("routing.format-by-foot");
			}
		default:
			return "";
	}
}

export type RouteQuery = {
	queries: string[];
	mode: string | null;
}

export function encodeRouteQuery(query: RouteQuery): string {
	const queries = query.queries.join(" to ");
	return query.mode != null ? `${queries} by ${query.mode}` : queries;
}

/**
 * Decodes a route query as encoded into English by encodeRouteQuery().
 */
export function decodeRouteQuery(query: string): RouteQuery {
	const splitBy = query.split(" by ");
	const splitTo = splitBy[0].split(" to ");
	return {
		queries: splitTo,
		mode: splitBy[1] ?? null
	};
}

/**
 * Attempts to interpret a route query as specified by the user in the current language.
 */
export function parseRouteQuery(query: string): RouteQuery {
	const i18n = getI18n();

	const routeModesByTranslation = Object.fromEntries(Object.entries({
		[i18n.t("routing.query-by-hgv")]: "car hgv",
		[i18n.t("routing.query-by-car")]: "car",
		[i18n.t("routing.query-by-road-bike")]: "bicycle road",
		[i18n.t("routing.query-by-mountain-bike")]: "bicycle mountain",
		[i18n.t("routing.query-by-electric-bike")]: "bicycle electric",
		[i18n.t("routing.query-by-bicycle")]: "bicycle",
		[i18n.t("routing.query-by-wheelchair")]: "pedestrian wheelchair",
		[i18n.t("routing.query-by-foot")]: "pedestrian",
		[i18n.t("routing.query-by-straight")]: ""
	}).flatMap(([k, v]) => k.split("|").map((k2) => [k2, v])));

	let queryWithoutMode = query;
	let mode = null;
	for (const [translation, thisMode] of Object.entries(routeModesByTranslation)) {
		const m = query.match(new RegExp(`(?<= |^)${quoteRegExp(translation)}(?= |$)`, "di"));
		if (m) {
			queryWithoutMode = `${query.slice(0, m.indices![0][0])}${query.slice(m.indices![0][1])}`.trim();
			mode = thisMode;
			break;
		}
	}

	const keywordsByTranslation = Object.fromEntries(Object.entries({
		[i18n.t("routing.query-from")]: "from",
		[i18n.t("routing.query-to")]: "to",
		[i18n.t("routing.query-via")]: "via"
	}).flatMap(([k, v]) => k.split("|").map((k2) => [k2.toLowerCase(), v])));

	const splitQuery = queryWithoutMode
		.split(new RegExp(`(?:^|\\s+)(${Object.keys(keywordsByTranslation).map((k) => quoteRegExp(k)).join("|")})(?:\\s+|$)`, "i"));

	const queryParts = {
		from: [] as string[],
		via: [] as string[],
		to: [] as string[]
	};

	for(let i=0; i<splitQuery.length; i+=2) {
		if(splitQuery[i]) {
			const thisKeyword = splitQuery[i - 1] ? keywordsByTranslation[splitQuery[i - 1].toLowerCase()] : "from";
			queryParts[thisKeyword as keyof typeof queryParts].push(splitQuery[i]);
		}
	}

	return {
		queries: queryParts.from.concat(queryParts.via, queryParts.to),
		mode
	};
}

/**
 * If true, this route can be handled by OSRM, ORS is not needed.
 */
export function isSimpleRoute(decodedMode: DecodedRouteMode): boolean {
	return !decodedMode.type &&
		(!decodedMode.preference || decodedMode.preference == "fastest") &&
		(!decodedMode.avoid || decodedMode.avoid.length == 0) &&
		!decodedMode.details;
}