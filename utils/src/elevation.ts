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
	const totalDistance = calculateDistance(trackPoints);
	return Object.fromEntries(Object.entries(extraInfo).map(([key, info]) => {
		const result: Record<number, number> = {};
		for (const segment in info) {
			result[info[segment][2]] = (result[info[segment][2]] ?? 0) + calculateDistance(trackSegment(trackPoints, info[segment][0], info[segment][1]));
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