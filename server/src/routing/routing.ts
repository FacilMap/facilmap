import { calculateBbox, isInBbox } from "../utils/geo";
import { calculateDistance } from "../../../frontend/common/utils";
import { decodeRouteMode } from "facilmap-frontend/common/routing";
import { Bbox, BboxWithZoom, Point, RouteMode, TrackPoint } from "../../../types/src";
import { DecodedRouteMode } from "../../../frontend/common/routing";
import { Line, LineCreate, LineExtraInfo, Route } from "facilmap-types";

const ors = require("./ors");
const osrm = require("./osrm");

// The OpenLayers resolution for zoom level 1 is 0.7031249999891753
// and for zoom level 20 0.0000013411044763239684
// This is the distance of one pixel on the map in degrees
// The resolution for zoom level 19 is the resolution for zoom level 20 times 2, and so on.
// As we don’t need one route point per pixel, we raise the value a bit
const RESOLUTION_20 = 0.0000013411044763239684 * 4;

export interface RouteInfo extends Bbox {
	distance: number;
	time?: number;
	ascent?: number;
	descent?: number;
	extraInfo?: LineExtraInfo;
	trackPoints: TrackPoint[];
}

export async function calculateRoute(routePoints: Point[], encodedMode: RouteMode) {
	let decodedMode = decodeRouteMode(encodedMode);

	let simple = isSimpleRoute(decodedMode);

	let route;

	if(simple || _needsOSRM(routePoints, decodedMode))
		route = await osrm.calculateRouting(routePoints, decodedMode.mode);

	if(!simple) {
		if(route) {
			// The distances between the current route points exceed the maximum for ORS, so we pick new
			// route points from the route calculated by OSRM
			routePoints = _getRoutePointsFromTrack(route.trackPoints, ors.getMaximumDistanceBetweenRoutePoints(decodedMode));
		}

		route = await ors.calculateRouting(routePoints, decodedMode);
	}

	calculateZoomLevels(route.trackPoints);

	return route;
}

export interface RoutingResult {
	distance: number;
	time?: number;
	ascent?: number;
	descent?: number;
	extraInfo?: LineExtraInfo;
	trackPoints: TrackPoint[];
}

export async function calculateRouteInfo(line: Pick<LineCreate, 'mode' | 'routePoints' | 'trackPoints'>, trackPointsFromRoute?: Route) {
	let result: Partial<RouteInfo> = {};

	if(trackPointsFromRoute) {
		result.distance = trackPointsFromRoute.distance;
		result.time = trackPointsFromRoute.time;
		result.ascent = trackPointsFromRoute.ascent;
		result.descent = trackPointsFromRoute.descent;
		result.extraInfo = trackPointsFromRoute.extraInfo;
		result.trackPoints = trackPointsFromRoute.trackPoints;
	} else if(line.mode == "track" && line.trackPoints && line.trackPoints.length >= 2) {
		result.distance = calculateDistance(line.trackPoints);
		result.time = undefined;
		result.extraInfo = {};

		// TODO: ascent/descent?

		calculateZoomLevels(line.trackPoints);

		for(let i=0; i<line.trackPoints.length; i++)
			line.trackPoints[i].idx = i;

		result.trackPoints = line.trackPoints;
	} else if(line.routePoints && line.routePoints.length >= 2 && line.mode != "track" && decodeRouteMode(line.mode).mode) {
		let routeData = await calculateRoute(line.routePoints, line.mode);
		result.distance = routeData.distance;
		result.time = routeData.time;
		result.ascent = routeData.ascent;
		result.descent = routeData.descent;
		result.extraInfo = routeData.extraInfo;
		for(let i=0; i<routeData.trackPoints.length; i++)
			routeData.trackPoints[i].idx = i;

		result.trackPoints = routeData.trackPoints;
	} else {
		result.distance = calculateDistance(line.routePoints);
		result.time = undefined;
		result.extraInfo = {};

		result.trackPoints = [ ];
		for(let i=0; i<line.routePoints.length; i++) {
			result.trackPoints.push({ ...line.routePoints[i], zoom: 1, idx: i });
		}
	}

	Object.assign(line, calculateBbox(result.trackPoints!));

	return result as RouteInfo;
}


export function isSimpleRoute(decodedMode: DecodedRouteMode) {
	return !decodedMode.type &&
		(!decodedMode.preference || decodedMode.preference == "fastest") &&
		(!decodedMode.avoid || decodedMode.avoid.length == 0) &&
		!decodedMode.details;
}

function _needsOSRM(routePoints: Point[], decodedMode: DecodedRouteMode) {
	let maxDist = ors.getMaximumDistanceBetweenRoutePoints(decodedMode);
	for(let i=1; i<routePoints.length; i++) {
		if(calculateDistance([ routePoints[i-1], routePoints[i] ]) > maxDist)
			return true;
	}
	return false;
}

function _getRoutePointsFromTrack(trackPoints: TrackPoint[], maxDistance: number) {
	let routePoints: Point[] = [ trackPoints[0] ];
	for(let i=1; i<trackPoints.length; i++) {
		let distance = calculateDistance([ routePoints[routePoints.length-1], trackPoints[i] ]);
		if(distance >= maxDistance) {
			if(routePoints[routePoints.length-1] !== trackPoints[i-1])
				routePoints.push(trackPoints[i-1]);
			else // Really long distance between two track points. Maybe a ferry line.
				routePoints.push(_percentageOfSegment(routePoints[routePoints.length-1], trackPoints[i], (maxDistance-1)/distance));
			i--;
		}
	}
	routePoints.push(trackPoints[trackPoints.length-1]);
	return routePoints;
}

function _percentageOfSegment(point1: Point, point2: Point, percentage: number): Point {
	return {
		lat: point1.lat + percentage * (point2.lat - point1.lat),
		lon: point1.lon + percentage * (point2.lon - point1.lon)
	};
}

export function calculateZoomLevels(trackPoints: TrackPoint[]) {
	var segments = [ ];
	var dist = 0;
	for(var i=0; i<trackPoints.length; i++) {
		if(i > 0)
			dist += distance(trackPoints[i-1], trackPoints[i]);
		segments[i] = dist / RESOLUTION_20;

		trackPoints[i].zoom = null;

		if(i != 0 && i != trackPoints.length-1) {
			var lastSegments = segments[i-1];
			var thisSegments = segments[i];
			for(var j = 0; j < 20; j++) {
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

export function distance(pos1: Point, pos2: Point) {
	return Math.sqrt(Math.pow(pos1.lon-pos2.lon, 2) + Math.pow(pos1.lat-pos2.lat, 2));
}

export function prepareForBoundingBox(trackPoints: TrackPoint[], bbox: BboxWithZoom, getCompleteBasicRoute: boolean) {
	trackPoints = filterByZoom(trackPoints, Math.max(bbox.zoom, getCompleteBasicRoute ? 5 : 0));
	trackPoints = filterByBbox(trackPoints, bbox, getCompleteBasicRoute);
	return trackPoints;
}

export function filterByZoom(trackPoints: TrackPoint[], zoom: number) {
	var ret = [ ];
	for(var i=0; i<trackPoints.length; i++) {
		if(trackPoints[i].zoom <= zoom)
			ret.push(trackPoints[i]);
	}
	return ret;
}

export function filterByBbox(trackPoints: TrackPoint[], bbox: Bbox, getCompleteBasicRoute: boolean) {
	var ret = [ ];
	var lastIn = false;
	for(var i=0; i<trackPoints.length; i++) {
		var isIn = isInBbox(trackPoints[i], bbox);
		if(isIn && !lastIn && i >= 1) {
			ret.push(trackPoints[i-1]);
		}
		if(isIn || lastIn || (getCompleteBasicRoute && trackPoints[i].zoom <= 5))
			ret.push(trackPoints[i]);

		lastIn = isIn;
	}
	return ret;
}