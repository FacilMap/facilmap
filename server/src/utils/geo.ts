import { Bbox, Point } from "facilmap-types";
import { Latitude } from "../../../types/src";

const R = 6371; // km

export function isInBbox(position: Point, bbox: Bbox) {
	if(position.lat > bbox.top || position.lat < bbox.bottom)
		return false;
	if(bbox.right < bbox.left) // bbox spans over lon = 180
		return (position.lon > bbox.left || position.lon < bbox.right);
	else
		return (position.lon > bbox.left && position.lon < bbox.right);
}

export function distanceToDegreesLat(km: number) {
	return km / (R * Math.PI / 180);
}

export function distanceToDegreesLon(km: number, lat: Latitude) {
	let fac = Math.cos(lat * Math.PI / 180);
	return km / (fac * R * Math.PI / 180)
}

export function calculateBbox(trackPoints: Point[]) {
	let bbox: Partial<Bbox> = { };

	for(let trackPoint of trackPoints) {
		if(bbox.top == null || trackPoint.lat > bbox.top)
			bbox.top = trackPoint.lat;
		if(bbox.bottom == null || trackPoint.lat < bbox.bottom)
			bbox.bottom = trackPoint.lat;
		if(bbox.left == null || trackPoint.lon < bbox.left)
			bbox.left = trackPoint.lon;
		if(bbox.right == null || trackPoint.lon > bbox.right)
			bbox.right = trackPoint.lon;
	}

	return bbox;
}
