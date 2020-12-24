import { calculateDistance } from "facilmap-frontend/common/utils";
import config from "../config";
import request from "../utils/request";
import { DecodedRouteMode } from "facilmap-frontend/common/routing";
import { ExtraInfo, Point } from "facilmap-types";
import { throttle } from "../utils/utils";
import { RawRouteInfo } from "./routing";

const ROUTING_URL = `https://api.openrouteservice.org/v2/directions`;

const ROUTING_MODES: Record<string, string> = {
	"car-": "driving-car",
	"bicycle-": "cycling-regular",
	"bicycle-road": "cycling-road",
	"bicycle-safe": "cycling-safe",
	"bicycle-mountain": "cycling-mountain",
	"bicycle-tour": "cycling-tour",
	"bicycle-electric": "cycling-electric",
	"pedestrian-": "foot-walking",
	"pedestrian-hiking": "foot-hiking",
	"pedestrian-wheelchair": "wheelchair",
};

const MAX_DISTANCE = {
	car: 6000000,
	bicycle: 30000000,
	pedestrian: 20000000
} as Record<DecodedRouteMode['mode'], number>;

export function getMaximumDistanceBetweenRoutePoints(decodedMode: DecodedRouteMode): number {
	return MAX_DISTANCE[decodedMode.mode];
}

export const calculateORSRoute = throttle(calculateRouteInternal, 4);

async function calculateRouteInternal(points: Point[], decodedMode: DecodedRouteMode): Promise<RawRouteInfo> {
	let currentGroup: Point[] = [];
	const coordGroups: Point[][] = [currentGroup];
	for(const point of points) {
		if(calculateDistance(currentGroup.concat([point])) >= MAX_DISTANCE[decodedMode.mode]) {
			if(currentGroup.length == 1)
				throw new Error("Too much distance between route points. Consider adding some via points.");

			coordGroups.push(currentGroup = [currentGroup[currentGroup.length-1]]);

			if(calculateDistance(currentGroup.concat([point])) >= MAX_DISTANCE[decodedMode.mode])
				throw new Error("Too much distance between route points. Consider adding some via points.");
		}

		currentGroup.push(point);
	}

	let results;

	try {
		results = await Promise.all(coordGroups.map((coords) => {
			const req: any = {
				coordinates: coords.map((point) => [point.lon, point.lat]),
				// + "&geometry_format=polyline"
				instructions: false
			};

			if(decodedMode.details) {
				req.elevation = true;
				req.extra_info = [ "surface", "waytype", "steepness" ];
				if(decodedMode.mode == "car") {
					req.extra_info.push("tollways");
				}
			}
			if(decodedMode.avoid) {
				req.options = {
					avoid_features: decodedMode.avoid.join("|")
				};
			}
			if(decodedMode.preference)
				req.preference = decodedMode.preference;

			return request.post({
				url: `${ROUTING_URL}/${ROUTING_MODES[`${decodedMode.mode}-${decodedMode.type || ""}`]}/geojson`,
				json: true,
				headers: {
					'Authorization': config.orsToken
				},
				body: JSON.stringify(req)
			});
		}));
	} catch(err) {
		console.log(err);
		if(err.response.body && err.response.body.error)
			throw new Error(err.response.body.error.message);
		else
			throw err;
	}

	const ret = {
		trackPoints: [] as Array<Point & { ele?: number }>,
		distance: 0,
		time: 0,
		ascent: decodedMode.details ? 0 : undefined,
		descent: decodedMode.details ? 0 : undefined,
		extraInfo: decodedMode.details ? {} as ExtraInfo : undefined
	};

	for(const body of results) {
		if(body && body.error) {
			throw new Error(body.error.message);
		}

		if(!body || !body.routes || !body.routes[0])
			throw new Error("Invalid response from routing server.");

		let idxAdd = ret.trackPoints.length;

		const trackPoints = body.routes[0].geometry.map((it: any) => ({ lat: it[1], lon: it[0], ele: it[2] }));
		if(trackPoints.length > 0 && ret.trackPoints.length > 0 && trackPoints[0].lat == ret.trackPoints[ret.trackPoints.length-1].lat && trackPoints[0].lon == ret.trackPoints[ret.trackPoints.length-1].lon) {
			trackPoints.shift();
			idxAdd--;
		}

		ret.trackPoints.push(...trackPoints);
		ret.distance += body.routes[0].summary.distance/1000;
		ret.time += body.routes[0].summary.duration;

		if(decodedMode.details) {
			ret.ascent += body.routes[0].summary.ascent;
			ret.descent += body.routes[0].summary.descent;

			for(const i of Object.keys(body.routes[0].extras)) {
				if(!ret.extraInfo![i])
					ret.extraInfo![i] = [];
				ret.extraInfo![i].push(...body.routes[0].extras[i].values.map((v: any) => ([v[0]+idxAdd, v[1]+idxAdd, v[2]])));
			}
		}
	}

	return ret;
}
