import type { Point } from "facilmap-types";

// const API_URL = "https://elevation.mapzen.com/height";
// const LIMIT = 500;
// const MIN_TIME_BETWEEN_REQUESTS = 600;

// const throttle = highland<() => void>();
// throttle.ratelimit(1, MIN_TIME_BETWEEN_REQUESTS).each((func) => {
// 	func();
// });

export async function _getThrottledSlot(): Promise<void> {
	// return new Promise<void>((resolve) => {
	// 	throttle.write(resolve);
	// });
}

export async function getElevationForPoint(point: Point): Promise<number | undefined> {
	const points = await getElevationForPoints([point]);
	return points[0];
}

export async function getElevationForPoints(points: Array<{ lat: string | number; lon: string | number }>): Promise<Array<number | undefined>> {
	return points.map(() => undefined);

	/*if(points.length == 0)
		return Promise.resolve([ ]);

	let ret = Promise.resolve([ ]);
	for(let i=0; i<points.length; i+=LIMIT) {
		ret = ret.then((heights) => {
			return elevation._getThrottledSlot().then(() => (heights));
		}).then((heights) => {
			let json = {
				encoded_polyline: polyline.encode(points.slice(i, i+LIMIT).map((point) => ([point.lat, point.lon])), 6),
				range: false
			};

			return request.get({
				url: `${API_URL}?json=${encodeURI(JSON.stringify(json))}&api_key=${config.mapzenToken}`,
				json: true
			}).then((res) => (heights.concat(res.height)));
		});
	}
	return ret;*/
}

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
