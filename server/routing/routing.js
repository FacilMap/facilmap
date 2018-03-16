const utils = require("../utils");

const ors = require("./ors");
const osrm = require("./osrm");
const commonRouting = require("facilmap-frontend/common/routing");

// The OpenLayers resolution for zoom level 1 is 0.7031249999891753
// and for zoom level 20 0.0000013411044763239684
// This is the distance of one pixel on the map in degrees
// The resolution for zoom level 19 is the resolution for zoom level 20 times 2, and so on.
// As we don’t need one route point per pixel, we raise the value a bit
const RESOLUTION_20 = 0.0000013411044763239684 * 4;


const routing = module.exports = {

	async calculateRouting(routePoints, encodedMode) {
		let decodedMode = commonRouting.decodeMode(encodedMode);

		let simple = routing.isSimpleRoute(decodedMode);

		let route;

		if(simple || routing._needsOSRM(routePoints, decodedMode))
			route = await osrm.calculateRouting(routePoints, decodedMode.mode);

		if(!simple) {
			if(route) {
				// The distances between the current route points exceed the maximum for ORS, so we pick new
				// route points from the route calculated by OSRM
				routePoints = routing._getRoutePointsFromTrack(route.trackPoints, ors.getMaximumDistanceBetweenRoutePoints(decodedMode));
			}

			route = await ors.calculateRouting(routePoints, decodedMode);
		}

		routing.calculateZoomLevels(route.trackPoints);

		return route;
	},

	isSimpleRoute(decodedMode) {
		return !decodedMode.type &&
			(!decodedMode.preference || decodedMode.preference == "fastest") &&
			(!decodedMode.avoid || decodedMode.avoid.length == 0) &&
			!decodedMode.details;
	},

	_needsOSRM(routePoints, decodedMode) {
		let maxDist = ors.getMaximumDistanceBetweenRoutePoints(decodedMode);
		for(let i=1; i<routePoints.length; i++) {
			if(utils.calculateDistance([ routePoints[i-1], routePoints[i] ]) > maxDist)
				return true;
		}
		return false;
	},

	_getRoutePointsFromTrack(trackPoints, maxDistance) {
		let routePoints = [ trackPoints[0] ];
		for(let i=1; i<trackPoints.length; i++) {
			let distance = utils.calculateDistance([ routePoints[routePoints.length-1], trackPoints[i] ]);
			if(distance >= maxDistance) {
				if(routePoints[routePoints.length-1] !== trackPoints[i-1])
					routePoints.push(trackPoints[i-1]);
				else // Really long distance between two track points. Maybe a ferry line.
					routePoints.push(routing._percentageOfSegment(routePoints[routePoints.length-1], trackPoints[i], (maxDistance-1)/distance));
				i--;
			}
		}
		routePoints.push(trackPoints[trackPoints.length-1]);
		return routePoints;
	},

	_percentageOfSegment(point1, point2, percentage) {
		return {
			lat: point1.lat + percentage * (point2.lat - point1.lat),
			lon: point1.lon + percentage * (point2.lon - point1.lon)
		};
	},

	calculateZoomLevels(trackPoints) {
		var segments = [ ];
		var dist = 0;
		for(var i=0; i<trackPoints.length; i++) {
			if(i > 0)
				dist += routing.distance(trackPoints[i-1], trackPoints[i]);
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
	},

	distance(pos1, pos2) {
		return Math.sqrt(Math.pow(pos1.lon-pos2.lon, 2) + Math.pow(pos1.lat-pos2.lat, 2));
	},

	prepareForBoundingBox(trackPoints, bbox, getCompleteBasicRoute) {
		trackPoints = routing.filterByZoom(trackPoints, Math.max(bbox.zoom, getCompleteBasicRoute ? 5 : 0));
		trackPoints = routing.filterByBbox(trackPoints, bbox, getCompleteBasicRoute);
		return trackPoints;
	},

	filterByZoom(trackPoints, zoom) {
		var ret = [ ];
		for(var i=0; i<trackPoints.length; i++) {
			if(trackPoints[i].zoom <= zoom)
				ret.push(trackPoints[i]);
		}
		return ret;
	},

	filterByBbox(trackPoints, bbox, getCompleteBasicRoute) {
		var ret = [ ];
		var lastIn = false;
		for(var i=0; i<trackPoints.length; i++) {
			var isIn = utils.isInBbox(trackPoints[i], bbox);
			if(isIn && !lastIn && i >= 1) {
				ret.push(trackPoints[i-1]);
			}
			if(isIn || lastIn || (getCompleteBasicRoute && trackPoints[i].zoom <= 5))
				ret.push(trackPoints[i]);

			lastIn = isIn;
		}
		return ret;
	}

};
