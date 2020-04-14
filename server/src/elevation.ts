import highland from "highland";
import polyline from "@mapbox/polyline";
import request from "./utils/request";
import { Point } from "../../types/src";

const config = require("../../config");


const API_URL = "https://elevation.mapzen.com/height";
const LIMIT = 500;
const MIN_TIME_BETWEEN_REQUESTS = 600;

const throttle = highland<() => void>();
throttle.ratelimit(1, MIN_TIME_BETWEEN_REQUESTS).each((func) => {
	func();
});

export function _getThrottledSlot() {
	return new Promise((resolve) => {
		throttle.write(resolve);
	});
}

export async function getElevationForPoint(point: Point) {
	const points = await getElevationForPoints([point]);
	return points[0];
}

export async function getElevationForPoints(points: Point[]): Promise<Array<number | null>> {
	return points.map(() => null);

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
	ascent: number;
	descent: number;
}

export function getAscentDescent(elevations: Array<number | null>) {
	if(!elevations.some((ele) => (ele != null))) {
		return {
			ascent: null,
			descent: null
		};
	}

	let ret: AscentDescent = {
		ascent: 0,
		descent: 0
	};

	let last: number | null = null;

	for(const ele of elevations) {
		if(last == null || ele == null)
			continue;

		if(ele > last)
			ret.ascent += ele - last;
		else
			ret.descent += last - ele;

		last = ele;
	}

	return ret;
}
