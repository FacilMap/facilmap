import { calculateBbox, isInBbox } from "../utils/geo.js";
import type { Bbox, BboxWithZoom, CRU, Line, Point, Route, RouteInfo, RouteMode, TrackPoint } from "facilmap-types";
import { decodeRouteMode, calculateDistance, round, isSimpleRoute } from "facilmap-utils";
import { calculateOSRMRoute } from "./osrm.js";
import { calculateORSRoute } from "./ors.js";
import config from "../config.js";

// The OpenLayers resolution for zoom level 1 is 0.7031249999891753
// and for zoom level 20 0.0000013411044763239684
// This is the distance of one pixel on the map in degrees
// The resolution for zoom level 19 is the resolution for zoom level 20 times 2, and so on.
// As we don’t need one route point per pixel, we raise the value a bit
const RESOLUTION_20 = 0.0000013411044763239684 * 4;

export type RawRouteInfo = Omit<RouteInfo, "trackPoints" | keyof Bbox> & {
	trackPoints: Array<Point & { ele?: number }>;
}

export async function calculateRoute(routePoints: Point[], encodedMode: RouteMode | undefined): Promise<RouteInfo> {
	const decodedMode = decodeRouteMode(encodedMode);

	const simple = (!config.mapboxToken && config.orsToken) ? false : isSimpleRoute(decodedMode);

	const route = (
		simple ? await calculateOSRMRoute(routePoints, decodedMode.mode) :
		await calculateORSRoute(routePoints, decodedMode)
	);

	return {
		...route,
		distance: round(route.distance, 2),
		time: route.time != null ? Math.round(route.time) : route.time,
		ascent: route.ascent != null ? Math.round(route.ascent) : route.ascent,
		descent: route.descent != null ? Math.round(route.descent) : route.descent,
		trackPoints: calculateDistance(calculateZoomLevels(route.trackPoints)).points,
		...calculateBbox(route!.trackPoints)
	} satisfies RouteInfo;
}

export async function calculateRouteForLine(line: Pick<Line<CRU.CREATE_VALIDATED>, 'mode' | 'routePoints' | 'trackPoints'>, trackPointsFromRoute?: Route): Promise<RouteInfo> {
	let result: Omit<RouteInfo, keyof Bbox>;

	if(trackPointsFromRoute) {
		result = {
			distance: trackPointsFromRoute.distance,
			time: trackPointsFromRoute.time,
			ascent: trackPointsFromRoute.ascent,
			descent: trackPointsFromRoute.descent,
			extraInfo: trackPointsFromRoute.extraInfo,
			extraInfoStats: trackPointsFromRoute.extraInfoStats,
			trackPoints: trackPointsFromRoute.trackPoints
		};
	} else if(line.mode == "track" && line.trackPoints && line.trackPoints.length >= 2) {
		const distance = calculateDistance(line.trackPoints);
		result = {
			distance: round(distance.distance, 2),
			time: undefined,
			extraInfo: undefined,
			extraInfoStats: undefined,
			trackPoints: calculateDistance(calculateZoomLevels(line.trackPoints)).points,
			// TODO: ascent/descent?
		};
	} else if(line.routePoints && line.routePoints.length >= 2 && line.mode != "track" && decodeRouteMode(line.mode).mode) {
		const routeData = await calculateRoute(line.routePoints, line.mode);
		result = {
			distance: routeData.distance,
			time: routeData.time,
			ascent: routeData.ascent,
			descent: routeData.descent,
			extraInfo: routeData.extraInfo,
			extraInfoStats: routeData.extraInfoStats,
			trackPoints: routeData.trackPoints
		};
	} else {
		const distance = calculateDistance(calculateZoomLevels(line.routePoints));
		result = {
			distance: round(distance.distance, 2),
			time: undefined,
			extraInfo: undefined,
			extraInfoStats: undefined,
			trackPoints: distance.points
		};
	}

	return {
		...result,
		...calculateBbox(result.trackPoints)
	};
}

export function calculateZoomLevels<T extends Point>(trackPoints: T[]): Array<T & { zoom: number; idx: number }> {
	const result = Array<T & { zoom: number; idx: number }>(trackPoints.length);
	const segments = [ ];
	let dist = 0;
	for(let i=0; i<trackPoints.length; i++) {
		if(i > 0)
			dist += distance(trackPoints[i-1], trackPoints[i]);
		segments[i] = dist / RESOLUTION_20;

		let zoom = 1;

		if(i != 0 && i != trackPoints.length-1) {
			let lastSegments = segments[i-1];
			let thisSegments = segments[i];
			for(let j = 0; j < 20; j++) {
				lastSegments = Math.floor(lastSegments / 2);
				thisSegments = Math.floor(thisSegments / 2);
				if(lastSegments == thisSegments) {
					zoom = 20 - j;
					break;
				}
			}
		}

		result[i] = { ...trackPoints[i], zoom, idx: i };
	}

	return result;
}

export function distance(pos1: Point, pos2: Point): number {
	return Math.sqrt(Math.pow(pos1.lon-pos2.lon, 2) + Math.pow(pos1.lat-pos2.lat, 2));
}

export function prepareForBoundingBox(trackPoints: TrackPoint[], bbox: BboxWithZoom, getCompleteBasicRoute = false): TrackPoint[] {
	trackPoints = filterByZoom(trackPoints, Math.max(bbox.zoom, getCompleteBasicRoute ? 5 : 0));
	trackPoints = filterByBbox(trackPoints, bbox, getCompleteBasicRoute);
	return trackPoints;
}

export function filterByZoom(trackPoints: TrackPoint[], zoom: number): TrackPoint[] {
	const ret: TrackPoint[] = [ ];
	for(let i=0; i<trackPoints.length; i++) {
		if(trackPoints[i].zoom <= zoom)
			ret.push(trackPoints[i]);
	}
	return ret;
}

export function filterByBbox(trackPoints: TrackPoint[], bbox: Bbox, getCompleteBasicRoute = false): TrackPoint[] {
	const ret: TrackPoint[] = [ ];
	let lastIn = false;
	for(let i=0; i<trackPoints.length; i++) {
		const isIn = isInBbox(trackPoints[i], bbox);
		if(isIn && !lastIn && i >= 1) {
			ret.push(trackPoints[i-1]);
		}
		if(isIn || lastIn || (getCompleteBasicRoute && trackPoints[i].zoom <= 5))
			ret.push(trackPoints[i]);

		lastIn = isIn;
	}
	return ret;
}