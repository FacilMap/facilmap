import type { Point } from "facilmap-types";
import { RetryError, throttledBatch } from "./utils.js";
import { fetchAdapter, getConfig } from "./config.js";
import { getI18n } from "./i18n.js";

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
