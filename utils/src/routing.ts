import type { DistributiveOmit, RouteMode } from "facilmap-types";
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
export function calculateDistance(posList: { readonly [idx: number]: { readonly lat: number; readonly lon: number }; readonly length: number }): number {
	// From http://stackoverflow.com/a/365853/242365
	let ret = 0;
	let last: { readonly lat: number; readonly lon: number } | undefined;
	for (let i = 0; i < posList.length; i++) {
		if (posList[i] != null) {
			if (last != null) {
				const lat1 = last.lat * Math.PI / 180;
				const lon1 = last.lon * Math.PI / 180;
				const lat2 = posList[i].lat * Math.PI / 180;
				const lon2 = posList[i].lon * Math.PI / 180;
				const dLat = lat2 - lat1;
				const dLon = lon2 - lon1;

				const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
					Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
				const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
				ret += R * c;
			}

			last = posList[i];
		}
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

type RawRouteQuerySegment<T extends string> = { keyword: false; value: string; rawValue: string } | { keyword: true; value: T; rawValue: string };
type RawRouteQuerySegmentInput<T extends string> = DistributiveOmit<RawRouteQuerySegment<T>, "rawValue">;

function getRawRouteQueryKeywordRegExp(keyword: string): string {
	return quoteRegExp(keyword).replaceAll(" ", "\\s+");
}

function joinRawRouteQuery<T extends string>(query: Array<RawRouteQuerySegmentInput<T>>): string {
	return query.map((q) => {
		// For historic reasons, we cannot distinguish between route queries serialized in English and route queries typed in the current language.
		// For example, when https://facilmap.org/#q=Berlin%20to%20Hamburg is opened, it could be a link that was created by FacilMap, containing the
		// serialized route query, but it could also be a route query that the user has typed into their browser where FacilMap is configured as a
		// search engine. Unfortunately, this makes the interpretation of route queries dependent on the user’s language. For example, if a link
		// to the URL https://facilmap.org/#q=Berlin%20vers%20Hamburg is shared, it would be interpreted as a route query if the user’s language is
		// French, but as a search term if the user’s language is not French. This can cause trouble in both ways: If a user intends to share a link
		// to a route, it might not be interpreted as a route on another device (but we cannot avoid this and users should share the link with the
		// serialized route query instead). If a user intends to share a link to a search, but one word in that search happens to be a route query
		// keyword in the user language on another device, that search would be interpreted as a route there. To prevent this, since we don’t know
		// all the future translations of the keywords, we simply quote all search terms when serializing a route query. An exception would be the
		// "m123" and "l123" terms for marker/line links and "n123", "w123" and "r123" terms for specific OpenStreetMap search results, since these
		// are the most serialized search terms in FacilMap and are very unlikely to collide with a future translation of a route query keyword.
		if (!q.keyword && !q.value.match(/^[mlnwr]\d+$/)) {
			return `"${q.value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
		} else {
			return q.value;
		}
	}).join(" ");
}

function splitRawRouteQuery<T extends string>(query: string, keywords: T[]): Array<RawRouteQuerySegment<T>> {
	const keywordRegExps = keywords.map((k) => [k, new RegExp(`^${getRawRouteQueryKeywordRegExp(k)}$`, "i")] as const);
	const matches = [...query.matchAll(new RegExp(`"|((?<=^|\\s+)(${keywords.map((k) => getRawRouteQueryKeywordRegExp(k)).join("|")})(?=\\s+|$))`, "ig"))];
	const result: Array<RawRouteQuerySegment<T>> = [{ keyword: false, rawValue: "", value: "" }];
	let isInQuote = false;
	for (let i = 0; i < matches.length; i++) {
		const afterLast = query.substring(i > 0 ? (matches[i-1].index + matches[i-1][0].length) : 0, matches[i].index);
		if (isInQuote) {
			result[result.length - 1].rawValue += `${afterLast}${matches[i][0]}`;

			if (matches[i][0] === "\"" && afterLast.match(/\\*$/)![0].length % 2 === 0) {
				result[result.length - 1].value += afterLast.replaceAll("\\\\", "\\");
				isInQuote = false;
			} else {
				result[result.length - 1].value += `${afterLast}${matches[i][0]}`.replaceAll(/\\([\\"])/g, "$1");
			}
		} else {
			result[result.length - 1].rawValue += afterLast;
			result[result.length - 1].value += afterLast;

			if (matches[i][0] === "\"") {
				result[result.length - 1].rawValue += matches[i][0];
				isInQuote = true;
			} else {
				result.push(
					{ keyword: true, rawValue: matches[i][1], value: keywordRegExps.find((k) => matches[i][1].match(k[1]))![0] },
					{ keyword: false, rawValue: "", value: "" }
				);
			}
		}
	}

	const afterLast = matches.length > 0 ? query.substring(matches[matches.length - 1].index + matches[matches.length - 1][0].length) : query;
	result[result.length - 1].value += isInQuote ? afterLast.replaceAll("\\\\", "\\") : afterLast;

	return result.flatMap((s) => {
		if (s.keyword) {
			return [s];
		} else {
			const trimmed = s.value.trim();
			return trimmed !== "" ? [{ ...s, value: trimmed } as RawRouteQuerySegment<T>] : [];
		}
	});
}

export type RouteQuery = {
	queries: string[];
	mode: string | null;
}

export function encodeRouteQuery(query: RouteQuery): string {
	const rawQuery: Array<RawRouteQuerySegmentInput<string>> = [
		...query.queries.flatMap((q, i) => [
			...i > 0 ? [{ keyword: true, value: "to" } as const] : [],
			{ keyword: false, value: q } as const
		]),
		...query.mode != null ? [
			{ keyword: true, value: "by" } as const,
			// Since mode is not a free-text field, conflicts with keyword translations are unlikely. Thus we declare it a a keyword here
			// (it is not a keyword when it comes out of decodeRouteQuery() below) so that it is not quoted.
			{ keyword: true, value: query.mode } as const
		] : []
	];
	return joinRawRouteQuery(rawQuery);
}

export function quoteSearchTerm(term: string): string {
	return joinRawRouteQuery([{ keyword: false, value: term }]);
}

export function unquoteSearchTerm(term: string): string {
	return splitRawRouteQuery(term, [])[0]?.value ?? "";
}

/**
 * Decodes a route query as encoded into English by encodeRouteQuery().
 */
export function decodeRouteQuery(query: string): RouteQuery {
	const parts = splitRawRouteQuery(query, ["to", "by"]);
	return {
		queries: parts.flatMap((p, i) => !p.keyword && (i === 0 || (parts[i - 1].keyword && parts[i - 1].value === "to")) ? [p.value] : []),
		mode: parts.find((p, i) => !p.keyword && i > 0 && parts[i - 1].keyword && parts[i - 1].value === "by")?.value ?? null
	};
}

/**
 * Attempts to interpret a route query as specified by the user in the current language.
 */
export function parseRouteQuery(query: string): RouteQuery {
	const i18n = getI18n();

	const keywordsByTranslation = Object.fromEntries(Object.entries({
		[i18n.t("routing.query-from")]: "from",
		[i18n.t("routing.query-to")]: "to",
		[i18n.t("routing.query-via")]: "via"
	}).flatMap(([k, v]) => k !== "" ? k.split("|").map((k2) => [k2, v]) : []));

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
	}).flatMap(([k, v]) => k !== "" ? k.split("|").map((k2) => [k2, v]) : []));

	const split = splitRawRouteQuery(query, [...Object.keys(keywordsByTranslation), ...Object.keys(routeModesByTranslation)]);

	const queryParts = {
		from: [] as string[],
		via: [] as string[],
		to: [] as string[]
	};
	let mode: string | null = null;

	for (let i = 0; i < split.length; i++) {
		if (!split[i].keyword && (i === 0 || (split[i - 1].keyword && Object.hasOwn(keywordsByTranslation, split[i - 1].value)))) {
			const thisKeyword = i === 0 ? "from" : keywordsByTranslation[split[i - 1].value];
			queryParts[thisKeyword as keyof typeof queryParts].push(split[i].value);
		} else if (split[i].keyword && Object.hasOwn(routeModesByTranslation, split[i].value) && mode == null) {
			mode = routeModesByTranslation[split[i].value];
		}
	}

	if (queryParts.to.length === 0) {
		// Not a route query
		return { queries: [query], mode: null };
	} else {
		return { queries: [...queryParts.from, ...queryParts.via, ...queryParts.to], mode };
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