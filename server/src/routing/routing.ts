import { calculateBbox, isInBbox } from "../utils/geo.js";
import type { Bbox, BboxWithZoom, CRU, Line, Point, RouteInfo, RouteMode, TrackPoint } from "facilmap-types";
import { decodeRouteMode, calculateDistance, round, isSimpleRoute } from "facilmap-utils";
import { calculateOSRMRoute } from "./osrm.js";
import { calculateORSRoute, getMaximumDistanceBetweenRoutePoints } from "./ors.js";
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

export async function calculateRoute(routePoints: Point[], encodedMode: RouteMode | undefined): Promise<RouteInfo & { trackPoints: TrackPoint[] }> {
	const decodedMode = decodeRouteMode(encodedMode);

	const simple = (!config.mapboxToken && config.orsToken) ? false : isSimpleRoute(decodedMode);

	let route: RawRouteInfo | undefined;

	if (simple) {
		route = await calculateOSRMRoute(routePoints, decodedMode.mode);
	}

	if(!simple) {
		if(route) {
			// The distances between the current route points exceed the maximum for ORS, so we pick new
			// route points from the route calculated by OSRM
			routePoints = _getTrackPointsFromTrack(route.trackPoints, getMaximumDistanceBetweenRoutePoints(decodedMode));
		}

		route = await calculateORSRoute(routePoints, decodedMode);
	}

	route!.distance = round(route!.distance, 2);
	route!.time = route!.time != null ? Math.round(route!.time) : route!.time;
	route!.ascent = route!.ascent != null ? Math.round(route!.ascent) : route!.ascent;
	route!.descent = route!.descent != null ? Math.round(route!.descent) : route!.descent;

	calculateZoomLevels(route!.trackPoints);

	return {
		...route,
		...calculateBbox(route!.trackPoints)
	} as RouteInfo & { trackPoints: TrackPoint[] };
}

export async function calculateRouteForLine(line: Pick<Line<CRU.CREATE_VALIDATED>, 'mode' | 'routePoints' | 'trackPoints'>): Promise<RouteInfo & { trackPoints: TrackPoint[] }> {
	const result: Partial<RouteInfo & { trackPoints: TrackPoint[] | AsyncIterable<TrackPoint> }> = {};

	if(line.mode == "track" && line.trackPoints && line.trackPoints.length >= 2) {
		result.distance = round(calculateDistance(line.trackPoints), 2);
		result.time = undefined;
		result.extraInfo = undefined;

		// TODO: ascent/descent?

		calculateZoomLevels(line.trackPoints);

		for(let i=0; i<line.trackPoints.length; i++)
			(line.trackPoints[i] as TrackPoint).idx = i;

		result.trackPoints = line.trackPoints as TrackPoint[];
	} else if(line.routePoints && line.routePoints.length >= 2 && line.mode != "track" && decodeRouteMode(line.mode).mode) {
		const routeData = await calculateRoute(line.routePoints, line.mode);
		result.distance = routeData.distance;
		result.time = routeData.time;
		result.ascent = routeData.ascent;
		result.descent = routeData.descent;
		result.extraInfo = routeData.extraInfo;
		for(let i=0; i<routeData.trackPoints.length; i++)
			routeData.trackPoints[i].idx = i;

		result.trackPoints = routeData.trackPoints;
	} else {
		result.distance = round(calculateDistance(line.routePoints), 2);
		result.time = undefined;
		result.extraInfo = undefined;

		result.trackPoints = [ ];
		for(let i=0; i<line.routePoints.length; i++) {
			result.trackPoints.push({ ...line.routePoints[i], ele: null, zoom: 1, idx: i });
		}
	}

	Object.assign(result, calculateBbox(result.trackPoints!));

	return result as RouteInfo & { trackPoints: TrackPoint[] };
}

function _getTrackPointsFromTrack(trackPoints: Point[], maxDistance: number) {
	const result: Point[] = [ trackPoints[0] ];
	for(let i=1; i<trackPoints.length; i++) {
		const distance = calculateDistance([ result[result.length-1], trackPoints[i] ]);
		if(distance >= maxDistance) {
			if(result[result.length-1] !== trackPoints[i-1])
				result.push(trackPoints[i-1]);
			else // Really long distance between two track points. Maybe a ferry line.
				result.push(_percentageOfSegment(result[result.length-1], trackPoints[i], (maxDistance-1)/distance));
			i--;
		}
	}
	result.push(trackPoints[trackPoints.length-1]);
	return result;
}

function _percentageOfSegment(point1: Point, point2: Point, percentage: number): Point {
	return {
		lat: point1.lat + percentage * (point2.lat - point1.lat),
		lon: point1.lon + percentage * (point2.lon - point1.lon)
	};
}

export function calculateZoomLevels(trackPoints: Array<Point & { zoom?: number }>): void {
	const segments = [ ];
	let dist = 0;
	for(let i=0; i<trackPoints.length; i++) {
		if(i > 0)
			dist += distance(trackPoints[i-1], trackPoints[i]);
		segments[i] = dist / RESOLUTION_20;

		trackPoints[i].zoom = undefined as any;

		if(i != 0 && i != trackPoints.length-1) {
			let lastSegments = segments[i-1];
			let thisSegments = segments[i];
			for(let j = 0; j < 20; j++) {
				lastSegments = Math.floor(lastSegments / 2);
				thisSegments = Math.floor(thisSegments / 2);
				if(lastSegments == thisSegments) {
					trackPoints[i].zoom = 20 - j;
					break;
				}
			}
		}

		if(trackPoints[i].zoom == null)
			trackPoints[i].zoom = 1;
	}
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