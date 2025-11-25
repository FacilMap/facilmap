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

type RawRouteQuerySegment<T extends string> = { keyword: false; value: string; rawValue: string } | { keyword: true; value: T; rawValue: string };
type RawRouteQuerySegmentInput<T extends string> = DistributiveOmit<RawRouteQuerySegment<T>, "rawValue">;

function getRawRouteQueryKeywordRegExp(keyword: string): string {
	return quoteRegExp(keyword).replaceAll(" ", "\\s+");
}

function joinRawRouteQuery<T extends string>(query: Array<RawRouteQuerySegmentInput<T>>, keywords: T[]): string {
	const keywordsRegExp = keywords.map((t) => new RegExp(`(^| )${getRawRouteQueryKeywordRegExp(t)}( |$)`, "i"));
	return query.map((q) => {
		if (!q.keyword && (q.value.includes("\"") || keywordsRegExp.some((k) => q.value.match(k)))) {
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
	const rawQuery: Array<RawRouteQuerySegmentInput<"to" | "by">> = [
		...query.queries.flatMap((q, i) => [
			...i > 0 ? [{ keyword: true, value: "to" } as const] : [],
			{ keyword: false, value: q } as const
		]),
		...query.mode != null ? [
			{ keyword: true, value: "by" } as const,
			{ keyword: false, value: query.mode } as const
		] : []
	];
	return joinRawRouteQuery(rawQuery, ["to", "by"]);
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