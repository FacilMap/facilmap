import { TrackPoints } from 'facilmap-client';
import { Bbox, BboxWithZoom, Point } from 'facilmap-types';
import L, { LatLng, LatLngBounds, Map, TooltipOptions } from 'leaflet';
import 'leaflet-geometryutil';

export const tooltipOptions: TooltipOptions = {
	direction: "right"
};

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

export interface BasicTrackPoints {
	[idx: number]: Point & { ele?: number };
    length: number;
}

export function trackPointsToLatLngArray(trackPoints: BasicTrackPoints | undefined): LatLng[] {
	const result: LatLng[] = [];
	if (trackPoints) {
		for (let i = 0; i < trackPoints.length; i++) {
			if (trackPoints[i]) {
				result.push(new LatLng(trackPoints[i]!.lat, trackPoints[i]!.lon, trackPoints[i]!.ele));
			}
		}
	}
	return result;
}