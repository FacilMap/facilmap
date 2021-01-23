import { Bbox, BboxWithZoom } from 'facilmap-types';
import L, { LatLng, LatLngBounds, Map } from 'leaflet';
import 'leaflet-geometryutil';

export function leafletToFmBbox(bbox: LatLngBounds): Bbox;
export function leafletToFmBbox(bbox: LatLngBounds, zoom: number): BboxWithZoom;
export function leafletToFmBbox(bbox: LatLngBounds, zoom?: number): Bbox & { zoom?: number } {
	const ret: Bbox & { zoom?: number } = {
		top: bbox.getNorth(),
		left: Math.max(-180, bbox.getWest()),
		right: Math.min(180, bbox.getEast()),
		bottom: bbox.getSouth()
	};

	if(zoom != null)
		ret.zoom = zoom;

	return ret;
}

export function fmToLeafletBbox(bbox: Bbox): LatLngBounds {
	return L.latLngBounds(L.latLng(bbox.bottom, bbox.left), L.latLng(bbox.top, bbox.right));
}

export function getClosestPointOnLine(map: Map, trackPoints: LatLng[], point: LatLng): LatLng {
	const index = getClosestIndexOnLine(map, trackPoints, point);
	const before = trackPoints[Math.floor(index)];
	const after = trackPoints[Math.ceil(index)];
	const percentage = index - Math.floor(index);
	return L.latLng(before.lat + percentage * (after.lat - before.lat), before.lng + percentage * (after.lng - before.lng));
}

export function getClosestIndexOnLine(map: Map, trackPoints: LatLng[], point: LatLng, startI?: number): number {
	let dist = Infinity;
	let idx = null;

	for(let i=(startI || 0); i<trackPoints.length-1; i++) {
		const thisDist = L.GeometryUtil.distanceSegment(map, point, trackPoints[i], trackPoints[i+1]);
		if(thisDist < dist) {
			dist = thisDist;
			idx = i;
		}
	}

	if(idx == null)
		return trackPoints.length;

	const closestPointOnSegment = L.GeometryUtil.closestOnSegment(map, point, trackPoints[idx], trackPoints[idx+1]);
	idx += L.GeometryUtil.distance(map, closestPointOnSegment, trackPoints[idx]) / L.GeometryUtil.distance(map, trackPoints[idx], trackPoints[idx+1]);

	return idx;
}

export function getIndexOnLine(map: Map, trackPoints: LatLng[], routePoints: LatLng[], point: LatLng): number {
	if(routePoints.length == 0)
		return 0;

	const idxs: number[] = [ ];
	for(let i=0; i<routePoints.length; i++) {
		idxs.push(getClosestIndexOnLine(map, trackPoints, routePoints[i], Math.floor(idxs[i-1])));
	}

	const pointIdx = getClosestIndexOnLine(map, trackPoints, point);

	if(pointIdx == 0)
		return 0;

	for(let i=0; i<idxs.length; i++) {
		if(idxs[i] > pointIdx)
			return i;
	}
	return idxs.length;
}

/**
 * Takes an array of track points and splits it up where two points in a row are outside of the given bbox.
 * @param trackPoints {Array<L.LatLng>}
 * @param bounds {L.LatLngBounds}
 * @return {Array<Array<L.LatLng>>}
 */
export function disconnectSegmentsOutsideViewport(trackPoints: LatLng[], bounds: LatLngBounds): LatLng[][] {
	const ret: LatLng[][] = [[]];
	let lastOneIn = true;
	let currentIdx = 0;

	for(const trackPoint of trackPoints) {
		if(bounds.contains(trackPoint)) {
			lastOneIn = true;
			ret[currentIdx].push(trackPoint);
		} else if(lastOneIn) {
			lastOneIn = false;
			ret[currentIdx].push(trackPoint);
		} else {
			if(ret[currentIdx].length > 1)
				currentIdx++;
			ret[currentIdx] = [trackPoint];
		}
	}

	if(ret[currentIdx].length <= 1)
		ret.pop();

	return ret;
}

/**
 * Finds out whether the two coordinates are roughly equal. The two points are considered roughly equal when the
 * projected distance between them is less than 1 pixel.
 * @param latLng1 {L.LatLng} The first point
 * @param latLng2 {L.LatLng} The second point
 * @param map {L.Map} The map on which the two points are shown
 * @param zoom {Number?} The zoom level at which the two points are shown. If not specified, the one of the map is used.
 * @returns {boolean} Whether the two points are roughly equal.
 */
export function pointsEqual(latLng1: LatLng, latLng2: LatLng, map: Map, zoom?: number): boolean {
	latLng1 = L.latLng(latLng1);
	latLng2 = L.latLng(latLng2);

	return map.project(latLng1, zoom).distanceTo(map.project(latLng2, zoom)) < 1;
}
