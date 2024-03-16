import type { Point } from "facilmap-types";
import config from "./config";

export async function getElevationForPoint(point: Point, failOnError = false): Promise<number | undefined> {
	const points = await getElevationForPoints([point], failOnError);
	return points[0];
}

export async function getElevationForPoints(points: Point[], failOnError = false): Promise<Array<number | undefined>> {
	if(points.length == 0) {
		return [];
	}

	try {
		const res = await fetch(`${config.openElevationApiUrl}/api/v1/lookup`, {
			method: "post",
			headers: {
				"Content-type": "application/json"
			},
			body: JSON.stringify({
				locations: points.map((point) => ({ latitude: point.lat, longitude: point.lon }))
			})
		});
		if (!res.ok) {
			throw new Error(`Looking up elevations failed with status ${res.status}.`);
		}
		const json: { results: Array<{ latitude: number; longitude: number; elevation: number }> } = await res.json();

		return json.results.map((result: any) => {
			if (result.elevation !== 0) {
				return result.elevation;
			}
		});
	} catch (err: any) {
		if (failOnError) {
			throw err;
		} else {
			console.warn("Error lookup up elevation", err);
			return points.map(() => undefined);
		}
	}
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
