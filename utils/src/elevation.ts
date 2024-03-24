import type { Point } from "facilmap-types";
import { RetryError, throttledBatch } from "./utils";
import { fetchAdapter, getConfig } from "./config";

const MIN_DELAY_MS = 1000; // Maximum one request per second, see https://github.com/Jorl17/open-elevation/issues/3
const MAX_DELAY_MS = 60_000;
const MAX_BATCH_SIZE = 200;

let delayMs = MIN_DELAY_MS;
let maxBatchSize = MAX_BATCH_SIZE;
let lastFailed = false;
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
		let error = new Error(`Looking up elevations failed with status ${res.status}.`);
		if (res.status === 504) {
			// Probably caused by an overload on the server. Usually it goes away after a while. Let's exponentially increase delays
			// between requests until it succeeds again.
			delayMs = Math.min(MAX_DELAY_MS, delayMs * 2);
			maxBatchSize = Math.max(1, Math.floor(maxBatchSize / 2));
			lastFailed = true;

			console.warn(`Looking up elevations failed with status ${res.status}, retrying (delay ${delayMs/1000}s, batch size ${maxBatchSize}).`);
			throw new RetryError(error);
		} else {
			throw error;
		}
	}

	if (lastFailed) {
		console.log(`Looking up elevations retry succeeded.`);
	}
	delayMs = MIN_DELAY_MS;
	maxBatchSize = MAX_BATCH_SIZE;
	lastFailed = false;

	const json: { results: Array<{ latitude: number; longitude: number; elevation: number }> } = await res.json();

	return json.results.map((result: any) => {
		if (result.elevation !== 0) {
			return result.elevation;
		}
	});
}, { delayMs: () => delayMs, maxSize: () => maxBatchSize, maxRetries: Infinity, noParallel: true });

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
