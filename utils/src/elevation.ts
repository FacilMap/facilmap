import type { ExtraInfo, ExtraInfoStats, Point } from "facilmap-types";
import { RetryError, throttledBatch } from "./utils.js";
import { fetchAdapter, getConfig } from "./config.js";
import { getI18n } from "./i18n.js";
import { calculateDistance } from "./routing.js";
import { round } from "./format.js";

const MAX_DELAY_MS = 60_000;

let retryCount = 0;
let delayMs = () => Math.min(MAX_DELAY_MS, getConfig().openElevationThrottleMs * (2 ** retryCount));
let maxBatchSize = () => Math.max(1, Math.floor(getConfig().openElevationMaxBatchSize / (2 ** retryCount)));
export const getElevationForPoint = throttledBatch<[Point], number | undefined>(async (args) => {
	const res = await fetchAdapter(`${getConfig().openElevationApiUrl}/api/v1/lookup`, {
		method: "post",
		headers: {
			"Content-type": "application/json"
		},
		body: JSON.stringify({
			locations: args.map(([point]) => ({ latitude: point.lat, longitude: point.lon }))
		})
	});
	if (!res.ok) {
		let error = new Error(getI18n().t("elevation.http-error", { status: res.status }));
		if (res.status === 504) {
			// Probably caused by an overload on the server. Usually it goes away after a while. Let's exponentially increase delays
			// between requests until it succeeds again.
			retryCount++;
			console.warn(`Looking up elevations failed with status ${res.status}, retrying (delay ${delayMs()/1000}s, batch size ${maxBatchSize()}).`);
			throw new RetryError(error);
		} else {
			throw error;
		}
	}

	if (retryCount > 0) {
		console.log(`Looking up elevations retry succeeded.`);
		retryCount = 0;
	}

	const json: { results: Array<{ latitude: number; longitude: number; elevation: number }> } = await res.json();

	return json.results.map((result: any) => {
		if (result.elevation !== 0) {
			return result.elevation;
		}
	});
}, {
	delayMs,
	maxSize: maxBatchSize,
	maxRetries: Infinity,
	noParallel: true
});

interface AscentDescent {
	ascent: number | undefined;
	descent: number | undefined;
}

export function getAscentDescent(elevations: Array<number | null>): AscentDescent {
	if(!elevations.some((ele) => (ele != null))) {
		return {
			ascent: undefined,
			descent: undefined
		};
	}

	const ret: AscentDescent = {
		ascent: 0,
		descent: 0
	};

	let last: number | null = null;

	for(const ele of elevations) {
		if(last == null || ele == null)
			continue;

		if(ele > last)
			ret.ascent! += ele - last;
		else
			ret.descent! += last - ele;

		last = ele;
	}

	return ret;
}

type BasicTrackPoints<T extends Point = Point> = {
	[idx: number]: T;
	length: number;
}

export function trackSegment<T extends Point>(trackPoints: BasicTrackPoints<T>, fromIdx: number, toIdx: number): T[] {
	let ret: T[] = [];

	for(let i=fromIdx; i<trackPoints.length; i++) {
		if (trackPoints[i]) {
			ret.push(trackPoints[i]);

			if (i >= toIdx) { // Makes sure that if toIdx does not exist in trackPoints, the next trackPoint is added, which avoids gaps between the segments, as required by leaflet.heightgraph
				break;
			}
		}
	}

	return ret;
}

export function createExtraInfoStats(extraInfo: ExtraInfo, trackPoints: BasicTrackPoints): ExtraInfoStats {
	const totalDistance = calculateDistance(trackPoints).distance;
	return Object.fromEntries(Object.entries(extraInfo).map(([key, info]) => {
		const result: Record<number, number> = {};
		for (const segment in info) {
			result[info[segment][2]] = (result[info[segment][2]] ?? 0) + calculateDistance(trackSegment(trackPoints, info[segment][0], info[segment][1])).distance;
		}
		return [key, Object.fromEntries(Object.entries(result).map(([k, v]) => {
			const percent = 100 * v / totalDistance;
			return [k, {
				distanceKm: v,
				percent: percent < 1 ? round(percent, 1) : Math.round(percent)
			}];
		}))];
	}));
}

export function getExtraInfoAtIdx(extraInfo: ExtraInfo, idx: number): Record<string, number> {
	return Object.fromEntries(Object.entries(extraInfo).flatMap(([key, info]) => {
		const segment = info.find((i) => idx >= i[0] && idx < i[1]);
		return segment ? [[key, segment[2]]] : [];
	}));
}

export function getTranslatedExtraInfoTypes(): Record<string, string> {
	const i18n = getI18n();
	return {
		steepness: i18n.t("extra-info.steepness"),
		waytype: i18n.t("extra-info.waytype"),
		surface: i18n.t("extra-info.surface"),
		suitablity: i18n.t("extra-info.suitability"),
		green: i18n.t("extra-info.green"),
		noise: i18n.t("extra-info.noise"),
		tollways: i18n.t("extra-info.tollways"),
		avgspeed: i18n.t("extra-info.avgspeed"),
		traildifficulty: i18n.t("extra-info.traildifficulty"),
		roadaccessrestrictions: i18n.t("extra-info.roadaccessrestrictions")
	};
}

export function getTranslatedExtraInfoValues(): Record<string, Record<number, { text: string; color: string }>> {
	const i18n = getI18n();
	return {
		steepness: {
			"-5": { text: "−16 % +", color: "#028306" },
			"-4": { text: "−10–15 %", color: "#2AA12E" },
			"-3": { text: "−7–9 %", color: "#53BF56" },
			"-2": { text: "−4–6 %", color: "#7BDD7E" },
			"-1": { text: "−1–3 %", color: "#A4FBA6" },
			"0": { text: "0 %", color: "#ffcc99" },
			"1": { text: "1–3 %", color: "#F29898" },
			"2": { text: "4–6 %", color: "#E07575" },
			"3": { text: "7–9 %", color: "#CF5352" },
			"4": { text: "10–15 %", color: "#BE312F" },
			"5": { text: "16 % +", color: "#AD0F0C" }
		},
		waytype: {
			"0": { text: i18n.t("extra-info.waytype-other"), color: "#30959e" },
			"1": { text: i18n.t("extra-info.waytype-state-road"), color: "#3f9da6" },
			"2": { text: i18n.t("extra-info.waytype-road"), color: "#4ea5ae" },
			"3": { text: i18n.t("extra-info.waytype-street"), color: "#5baeb5" },
			"4": { text: i18n.t("extra-info.waytype-path"), color: "#67b5bd" },
			"5": { text: i18n.t("extra-info.waytype-track"), color: "#73bdc4" },
			"6": { text: i18n.t("extra-info.waytype-cycleway"), color: "#7fc7cd" },
			"7": { text: i18n.t("extra-info.waytype-footway"), color: "#8acfd5" },
			"8": { text: i18n.t("extra-info.waytype-steps"), color: "#96d7dc" },
			"9": { text: i18n.t("extra-info.waytype-ferry"), color: "#a2dfe5" },
			"10": { text: i18n.t("extra-info.waytype-construction"), color: "#ade8ed" }
		},
		surface: {
			"0": { text: i18n.t("extra-info.surface-other"), color: "#ddcdeb" },
			"1": { text: i18n.t("extra-info.surface-paved"), color: "#cdb8df" },
			"2": { text: i18n.t("extra-info.surface-unpaved"), color: "#d2c0e3" },
			"3": { text: i18n.t("extra-info.surface-asphalt"), color: "#bca4d3" },
			"4": { text: i18n.t("extra-info.surface-contrete"), color: "#c1abd7" },
			"5": { text: i18n.t("extra-info.surface-cobblestone"), color: "#c7b2db" },
			"6": { text: i18n.t("extra-info.surface-metal"), color: "#e8dcf3" },
			"7": { text: i18n.t("extra-info.surface-wood"), color: "#eee3f7" },
			"8": { text: i18n.t("extra-info.surface-compacted-gravel"), color: "#d8c6e7" },
			"9": { text: i18n.t("extra-info.surface-fine-gravel"), color: "#8f9de4" },
			"10": { text: i18n.t("extra-info.surface-gravel"), color: "#e3d4ef" },
			"11": { text: i18n.t("extra-info.surface-dirt"), color: "#99a6e7" },
			"12": { text: i18n.t("extra-info.surface-ground"), color: "#a3aeeb" },
			"13": { text: i18n.t("extra-info.surface-ice"), color: "#acb6ee" },
			"14": { text: i18n.t("extra-info.surface-paving-stones"), color: "#b6c0f2" },
			"15": { text: i18n.t("extra-info.surface-sand"), color: "#c9d1f8" },
			"16": { text: i18n.t("extra-info.surface-woodchips"), color: "#c0c8f5" },
			"17": { text: i18n.t("extra-info.surface-grass"), color: "#d2dafc" },
			"18": { text: i18n.t("extra-info.surface-grass-paver"), color: "#dbe3ff" }
		},
		suitability: {
			"3": { text: "3/10", color: "#3D3D3D" },
			"4": { text: "4/10", color: "#4D4D4D" },
			"5": { text: "5/10", color: "#5D5D5D" },
			"6": { text: "6/10", color: "#6D6D6D" },
			"7": { text: "7/10", color: "#7C7C7C" },
			"8": { text: "8/10", color: "#8D8D8D" },
			"9": { text: "9/10", color: "#9D9D9D" },
			"10": { text: "10/10", color: "#ADADAD" }
		},
		green: {
			"3": { text: "10/10", color: "#8ec639" },
			"4": { text: "9/10", color: "#99c93c" },
			"5": { text: "8/10", color: "#a4cc40" },
			"6": { text: "7/10", color: "#afcf43" },
			"7": { text: "6/10", color: "#bbd246" },
			"8": { text: "5/10", color: "#c6d54a" },
			"9": { text: "4/10", color: "#d1d84e" },
			"10": { text: "3/10", color: "#dcdc51" }
		},
		noise: {
			"7": { text: "7/10", color: "#F8A056" },
			"8": { text: "8/10", color: "#EA7F27" },
			"9": { text: "9/10", color: "#A04900" },
			"10": { text: "10/10", color: "#773600" }
		},
		tollways: {
			"0": { text: i18n.t("extra-info.tollway-no"), color: "#6ca97b" },
			"1": { text: i18n.t("extra-info.tollway-yes"), color: "#ffb347" }
		},
		avgspeed: {
			// TODO: Make these available in miles
			"3": { text: "3 km/h", color: "#f2fdff" },
			"4": { text: "4 km/h", color: "#D8FAFF" },
			"5": { text: "5 km/h", color: "bff7ff" },
			"6": { text: "6–8 km/h", color: "#f2f7ff" },
			"9": { text: "9–12 km/h", color: "#d8e9ff" },
			"13": { text: "13–16 km/h", color: "#bedaff" },
			"17": { text: "17–20 km/h", color: "#a5cbff" },
			"21": { text: "21–24 km/h", color: "#8cbcff" },
			"25": { text: "25–29 km/h", color: "#72aeff" },
			"30": { text: "30–34 km/h", color: "#599fff" },
			"35": { text: "35–39 km/h", color: "#3f91ff" },
			"40": { text: "40–44 km/h", color: "#2682ff" },
			"45": { text: "45–49 km/h", color: "#0d73ff" },
			"50": { text: "50–59 km/h", color: "#0067f2" },
			"60": { text: "60–69 km/h", color: "#005cd9" },
			"70": { text: "70–79 km/h", color: "#0051c0" },
			"80": { text: "80–99 km/h", color: "#0046a6" },
			"100": { text: "100–119 km/h", color: "#003c8d" },
			"120": { text: "+120 km/h", color: "#003174" }
		},
		traildifficulty: {
			"0": { text: i18n.t("extra-info.traildifficulty-unknown"), color: "#dfecec" },
			"1": { text: "S0", color: "#9fc6c6" },
			"2": { text: "S1", color: "#80b3b3" },
			"3": { text: "S2", color: "#609f9f" },
			"4": { text: "S3", color: "#4d8080" },
			"5": { text: "S4", color: "#396060" },
			"6": { text: "S5", color: "#264040" },
			"7": { text: ">S5", color: "#132020" }
		},
		roadaccessrestrictions: {
			"0": { text: i18n.t("extra-info.access-yes"), color: "#fe7f6c" },
			"1": { text: i18n.t("extra-info.access-no"), color: "#FE7F9C" },
			"2": { text: i18n.t("extra-info.access-customers"), color: "#FDAB9F" },
			"4": { text: i18n.t("extra-info.access-destination"), color: "#FF66CC" },
			"8": { text: i18n.t("extra-info.access-delivery"), color: "#FDB9C8" },
			"16": { text: i18n.t("extra-info.access-private"), color: "#F64A8A" },
			"32": { text: i18n.t("extra-info.access-permissive"), color: "#E0115F" }
		}
	};
}