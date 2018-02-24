import fm from '../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import 'leaflet-geometryutil';
import linkifyStr from 'linkifyjs/string';
import Clipboard from 'clipboard';
import SimpleGraticule from 'leaflet-simple-graticule';

import commonFormat from '../../common/format';
import commonUtils from '../../common/utils';

fm.app.factory("fmUtils", function($parse, fmIcons) {

	var fmUtils = { };

	var LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	var LENGTH = 12;

	var shortLinkCharArray = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_@";

	fmUtils.RAINBOW_STOPS = `<stop offset="0" stop-color="red"/><stop offset="33%" stop-color="#ff0"/><stop offset="50%" stop-color="#0f0"/><stop offset="67%" stop-color="cyan"/><stop offset="100%" stop-color="blue"/>`;

	fmUtils.MARKER_SHAPES = {
		drop: {
			svg: `<path style="stroke:%BORDER_COLOUR%;stroke-linecap:round;fill:%COLOUR%" d="m11.5 0.5c-7 0-11 4-11 11s9.9375 19 11 19 11-12 11-19-4-11-11-11z"/>
			      <g transform="translate(2.9, 3.3)">%SYMBOL%</g>`,
			highlightSvg: `<path style="stroke:%BORDER_COLOUR%;stroke-width:3;stroke-linecap:round;fill:%COLOUR%" d="m11.5 0.5c-7 0-11 4-11 11s9.9375 19 11 19 11-12 11-19-4-11-11-11z"/>
			               <g transform="translate(2.9, 3.3)">%SYMBOL%</g>`,
			height: 31,
			width: 23,
			baseX: 12,
			baseY: 31
		},
		circle: {
			svg: `<circle style="stroke:%BORDER_COLOUR%;fill:%COLOUR%;" cx="13" cy="13" r="12.5" />
			      <g transform="translate(4.642, 4.642)">%SYMBOL%</g>`,
			highlightSvg: `<circle style="stroke:%BORDER_COLOUR%;stroke-width:3;fill:%COLOUR%;" cx="13" cy="13" r="12.5" />
			      <g transform="translate(4.642, 4.642)">%SYMBOL%</g>`,
			height: 26,
			width: 26,
			baseX: 13,
			baseY: 13
		}
	};

	fmUtils.generateRandomPadId = function(length) {
		if(length == null)
			length = LENGTH;

		var randomPadId = "";
		for(var i=0; i<length; i++) {
			randomPadId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
		}
		return randomPadId;
	};

	fmUtils.getSymbolCode = function(colour, size, symbol) {
		if(symbol && fmIcons.iconList.includes(symbol))
			return fmIcons.getIcon(colour, size, symbol);
		else if(symbol && symbol.length == 1)
			return `<text x="8.5" y="15" style="font-size:18px;text-anchor:middle;font-family:\'Helvetica\'"><tspan style="fill:${colour}">${fmUtils.quoteHtml(symbol)}</tspan></text>`;
		else
			return `<circle style="fill:${colour}" cx="8.6" cy="7.7" r="3" />`;
	};

	fmUtils.createSymbol = function(colour, height, symbol) {
		let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${height}" height="${height}" version="1.1">` +
			fmUtils.getSymbolCode('#'+colour, height, symbol) +
		`</svg>`;

		return `data:image/svg+xml,${encodeURIComponent(svg)}`;
	};

	fmUtils.createSymbolHtml = function(colour, height, symbol) {
		return `<svg width="${height}" height="${height}" viewbox="0 0 ${height} ${height}">` +
			fmUtils.getSymbolCode(colour, height, symbol) +
		`</svg>`;
	};

	fmUtils.createMarkerGraphic = function(colour, height, symbol, shape, padding, highlight) {
		let borderColour = fmUtils.makeTextColour(colour || "ffffff", 0.3);
		padding = Math.max(padding || 0, highlight ? 10 * height / 31 : 0);

		let shapeObj = fmUtils.MARKER_SHAPES[shape] || fmUtils.MARKER_SHAPES.drop;
		let shapeCode = (highlight ? shapeObj.highlightSvg : shapeObj.svg)
			.replace(/%BORDER_COLOUR%/g, "#"+borderColour)
			.replace(/%COLOUR%/g, colour == null ? "url(#rainbow)" : "#" + colour)
			.replace(/%SYMBOL%/g, fmUtils.getSymbolCode("#"+borderColour, 17, symbol));

		let scale = height / 31;

		return "data:image/svg+xml,"+encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
			`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.ceil(shapeObj.width * scale) + padding*2}" height="${Math.ceil(shapeObj.height * scale) + padding*2}" version="1.1">` +
			(colour == null ? `<defs><linearGradient id="rainbow" x2="0" y2="100%">${fmUtils.RAINBOW_STOPS}</linearGradient></defs>` : ``) +
			`<g transform="translate(${padding} ${padding}) scale(${scale})">` +
			shapeCode +
			`</g>` +
			`</svg>`);
	};

	fmUtils.createMarkerIcon = function(colour, height, symbol, shape, padding, highlight) {
		let scale = height / 31;
		padding = Math.max(padding || 0, highlight ? 10 * scale : 0);
		let shapeObj = fmUtils.MARKER_SHAPES[shape] || fmUtils.MARKER_SHAPES.drop;
		return L.icon({
			iconUrl: fmUtils.createMarkerGraphic(colour, height, symbol, shape, padding, highlight),
			iconSize: [padding*2 + shapeObj.width*scale, padding*2 + shapeObj.height*scale],
			iconAnchor: [padding + Math.round(shapeObj.baseX*scale), padding + Math.round(shapeObj.baseY*scale)],
			popupAnchor: [0, -height]
		});
	};

	fmUtils.createLineGraphic = function(colour, width, length) {
		return "data:image/svg+xml,"+encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
			`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${length}" height="${width}" version="1.1">` +
			(colour == null ? `<defs><linearGradient id="rainbow" x2="100%" y2="0">${fmUtils.RAINBOW_STOPS}</linearGradient></defs>` : ``) +
			`<rect x="0" y="0" width="${length}" height="${width}" style="fill:${colour == null ? `url(#rainbow)` : `#${colour}`}"/>` +
			`</svg>`);
	};

	fmUtils.makeTextColour = function(backgroundColour, threshold) {
		if(threshold == null)
			threshold = 0.5;

		return (fmUtils.getBrightness(backgroundColour) <= threshold) ? "ffffff" : "000000";
	};

	fmUtils.getBrightness = function(colour) {
		var r = parseInt(colour.substr(0, 2), 16)/255;
		var g = parseInt(colour.substr(2, 2), 16)/255;
		var b = parseInt(colour.substr(4, 2), 16)/255;
		// See http://stackoverflow.com/a/596243/242365
		return Math.sqrt(0.241*r*r + 0.691*g*g + 0.068*b*b);
	};

	fmUtils.overwriteObject = function(from, to) {
		for(var i in to)
			delete to[i];
		for(var i in from)
			to[i] = from[i];
	};

	fmUtils.quoteJavaScript = commonUtils.quoteJavaScript;
	fmUtils.quoteHtml = commonUtils.quoteHtml;
	fmUtils.quoteRegExp = commonUtils.quoteRegExp;

	fmUtils.round = commonFormat.round;
	fmUtils.formatTime = commonFormat.formatTime;
	fmUtils.routingMode = commonFormat.routingMode;

	fmUtils.preserveObject = function(scope, sourceExpr, targetExpr, onDelete) {
		var obj,bkp;

		function _update(firstTime) {
			obj = $parse(sourceExpr)(scope);

			if(firstTime && obj == null)
				obj = $parse(targetExpr)(scope);

			bkp = ng.copy(obj);

			if(sourceExpr != targetExpr)
				$parse(targetExpr + " = " + sourceExpr)(scope);
		}

		_update(true);

		var unwatch = scope.$watch(sourceExpr, function(newVal) {
			_update(false);

			if(newVal == null) {
				unwatch();
				if(onDelete)
					onDelete();
			}
		});

		return {
			revert : function() {
				if(bkp == null)
					return;

				fmUtils.overwriteObject(bkp, obj);
				unwatch();
			},
			leave : function() {
				unwatch();
				bkp = null;
			}
		}
	};

	fmUtils.leafletToFmBbox = function(bbox, zoom) {
		var ret = {
			top: bbox.getNorth(),
			left: Math.max(-180, bbox.getWest()),
			right: Math.min(180, bbox.getEast()),
			bottom: bbox.getSouth()
		};

		if(zoom != null)
			ret.zoom = zoom;

		return ret;
	};

	fmUtils.fmToLeafletBbox = function(bbox) {
		return L.latLngBounds(L.latLng(bbox.bottom, bbox.left), L.latLng(bbox.top, bbox.right));
	};

	fmUtils.getClosestIndexOnLine = function(map, trackPoints, point, startI) {
		var dist = Infinity;
		var idx = null;

		for(var i=(startI || 0); i<trackPoints.length-1; i++) {
			var thisDist = L.GeometryUtil.distanceSegment(map, point, trackPoints[i], trackPoints[i+1]);
			if(thisDist < dist) {
				dist = thisDist;
				idx = i;
			}
		}

		if(idx == null)
			return trackPoints.length;

		var closestPointOnSegment = L.GeometryUtil.closestOnSegment(map, point, trackPoints[idx], trackPoints[idx+1]);
		idx += L.GeometryUtil.distance(map, closestPointOnSegment, trackPoints[idx]) / L.GeometryUtil.distance(map, trackPoints[idx], trackPoints[idx+1]);

		return idx;
	};

	fmUtils.getIndexOnLine = function(map, trackPoints, routePoints, point) {
		if(routePoints.length == 0)
			return 0;

		var idxs = [ ];
		for(var i=0; i<routePoints.length; i++) {
			idxs.push(fmUtils.getClosestIndexOnLine(map, trackPoints, routePoints[i], Math.floor(idxs[i-1])));
		}

		var pointIdx = fmUtils.getClosestIndexOnLine(map, trackPoints, point);

		if(pointIdx == 0)
			return 0;

		for(var i=0; i<idxs.length; i++) {
			if(idxs[i] > pointIdx)
				return i;
		}
		return idxs.length;
	};

	fmUtils.copyToClipboard = function(text) {
		var el = $('<button type="button"></button>').css("display", "none").appendTo("body");
		var c = new Clipboard(el[0], {
			text: function() {
				return text;
			}
		});
		el.click().remove();
		c.destroy();
	};

	/**
	 * Make sure that a function is not called more often than every <interval> seconds.
	 * @param interval The minimum interval in milliseconds
	 * @param cancel If true, a new function call will delay the next call of the function by <interval>.
	 * @returns {Function} Pass a function to this function that will be called
	 */
	fmUtils.minInterval = function(interval, cancel) {
		var timeout = null;
		var runningPromise = null;
		var nextFunc = null;

		var ret = function(func) {
			nextFunc = func;

			if(timeout != null && cancel) {
				clearTimeout(timeout);
				timeout = null;
			}

			if(timeout == null) {
				timeout = setTimeout(function() {
					timeout = null;

					if(runningPromise && runningPromise.then)
						return ret(nextFunc);

					var f = nextFunc;
					nextFunc = null;
					var p = f();

					if(p)
						runningPromise = p.then(function() { runningPromise = null; });
				}, interval);
			}
		};
		return ret;
	};

	fmUtils.temporaryDragMarker = function(map, line, colour, callback, additionalOptions) {
		// This marker is shown when we hover the line. It enables us to create new markers.
		// It is a huge one (a normal marker with 5000 px or so transparency around it, so that we can be
		// sure that the mouse is over it and dragging it will work smoothly.
		var temporaryHoverMarker;
		function _over(e) {
			temporaryHoverMarker.setLatLng(e.latlng).addTo(map);
		}

		function _move(e) {
			temporaryHoverMarker.setLatLng(e.latlng);
		}

		function _out(e) {
			temporaryHoverMarker.remove();
		}

		line.on("mouseover", _over).on("mousemove", _move).on("mouseout", _out);

		function makeTemporaryHoverMarker() {
			temporaryHoverMarker = L.marker([0,0], Object.assign({
				icon: fmUtils.createMarkerIcon(colour, 35, null, null, 1000),
				draggable: true,
				rise: true
			}, additionalOptions)).once("dragstart", function() {
				temporaryHoverMarker.once("dragend", function() {
					// We have to replace the huge icon with the regular one at the end of the dragging, otherwise
					// the dragging gets interrupted
					this.setIcon(fmUtils.createMarkerIcon(colour));
				}, temporaryHoverMarker);

				callback(temporaryHoverMarker);

				makeTemporaryHoverMarker();
			});
		}

		makeTemporaryHoverMarker();

		return function() {
			line.off("mouseover", _over).off("mousemove", _move).off("mouseout", _out);
			temporaryHoverMarker.remove();
		};
	};

	fmUtils.splitRouteQuery = function(query) {
		var ret = {
			queries: [ ],
			mode: null
		};

		query = query.replace(/(^|\s+)by\s+([^\s]+)/gi, function(m0, m1, mode) {
			ret.mode = mode;
			return "";
		});

		var spl = query.replace(/^\s*from\s+/i, "").split(/\s+to\s+/i);
		spl.forEach(function(it, i1) {
			var spl2 = it.split(/\s+via\s+/i);

			spl2.forEach(function(it2, i2) {
				if(i1 == spl.length-1 && i2 != 0)
					ret.queries.splice(-1, 0, it2); // vias after the last to should be inserted before the last to (Berlin to Hamburg via Munich should become Berlin, Munich, Hamburg)
				else
					ret.queries.push(it2);
			})
		});

		return ret;
	};

	/**
	 * Checks whether the given query string is a representation of coordinates, such an OSM permalink.
	 * @param query {String}
	 * @return {Object} An object with the properties “lonlat” and “zoom” or null
	 */
	fmUtils.decodeLonLatUrl = function(query) {
		var query = query.replace(/^\s+/, "").replace(/\s+$/, "");
		var query_match,query_match2;
		if(query_match = query.match(/^http:\/\/(www\.)?osm\.org\/go\/([-A-Za-z0-9_@]+)/))
		{ // Coordinates, shortlink
			return fmUtils.decodeShortLink(query_match[2]);
		}

		function decodeQueryString(str) {
			var lonMatch,latMatch,leafletMatch;

			if((lonMatch = str.match(/[?&]lat=([^&]+)/)) && (latMatch = str.match(/[?&]lat=([^&]+)/))) {
				return {
					lat: 1*decodeURIComponent(latMatch[1]),
					lon: 1*decodeURIComponent(lonMatch[1]),
					zoom: 15
				};
			}

			if(leafletMatch = str.match(/(^|=)(\d+)\/(-?\d+(\.\d+)?)\/(-?\d+(\.\d+)?)(&|\/|$)/)) {
				return {
					lat: leafletMatch[3],
					lon: leafletMatch[5],
					zoom: leafletMatch[2]
				};
			}
		}

		if((query_match = query.match(/^https?:\/\/.*#(.*)$/)) && (query_match2 = decodeQueryString(query_match[1]))) {
			return query_match2;
		}

		if((query_match = query.match(/^https?:\/\/.*\?([^#]*)/)) && (query_match2 = decodeQueryString(query_match[1]))) {
			return query_match2;
		}

		return null;
	};

	/**
	 * Decodes a string from FacilMap.Util.encodeShortLink().
	 * @param encoded {String}
	 * @return {Object} (lonlat: OpenLayers.LonLat, zoom: Number)
	*/
	fmUtils.decodeShortLink = function(encoded) {
		var lon,lat,zoom;

		var m = encoded.match(/^([A-Za-z0-9_@]+)/);
		if(!m) return false;
		zoom = m[1].length*2+encoded.length-11;

		var c1 = 0;
		var c2 = 0;
		for(var i=0,j=54; i<m[1].length; i++,j-=6)
		{
			var bits = shortLinkCharArray.indexOf(m[1].charAt(i));
			if(j <= 30)
				c1 |= bits >>> (30-j);
			else if(j > 30)
				c1 |= bits << (j-30);
			if(j < 30)
				c2 |= (bits & (0x3fffffff >>> j)) << j;
		}

		var x = 0;
		var y = 0;

		for(var j=29; j>0;)
		{
			x = (x << 1) | ((c1 >> j--) & 1);
			y = (y << 1) | ((c1 >> j--) & 1);
		}
		for(var j=29; j>0;)
		{
			x = (x << 1) | ((c2 >> j--) & 1);
			y = (y << 1) | ((c2 >> j--) & 1);
		}

		x *= 4; // We can’t do <<= 2 here as x and y may be greater than 2³¹ and then the value would become negative
		y *= 4;

		lon = x*90.0/(1<<30)-180.0;
		lat = y*45.0/(1<<30)-90.0;

		return {
			lat : Math.round(lat*100000)/100000,
			lon: Math.round(lon*100000)/100000,
			zoom : zoom
		};
	};

	fmUtils.onLongMouseDown = function(map, callback) {
		var mouseDownTimeout, pos;

		function clear() {
			clearTimeout(mouseDownTimeout);
			mouseDownTimeout = pos = null;
			map.off("mousemove", move);
			map.off("mouseup", clear);
		}

		function move(e) {
			if(pos.distanceTo(e.containerPoint) > map.dragging._draggable.options.clickTolerance)
				clear();
		}

		map.on("mousedown", function(e) {
			clear();

			if(e.originalEvent.which != 1) // Only react to left click
				return;

			pos = e.containerPoint;
			mouseDownTimeout = setTimeout(function() {
				callback(e);
			}, 1000);

			map.on("mousemove", move);
			map.on("mouseup", clear);
		});
	};

	fmUtils.isSearchId = function(string) {
		return string && string.match(/^[nwr]\d+$/i);
	};

	fmUtils.freieTonne = function(map, options) {
		var layer = L.featureGroup([]);
		L.setOptions(layer, options);

		function refresh() {
			var bounds = fmUtils.leafletToFmBbox(map.map.getBounds());
			var zoom = map.map.getZoom();
			if(zoom <= 8)
				layer.clearLayers();
			else {
				map.client.find({
					query: "https://www.freietonne.de/seekarte/getOpenLayerPois.php?ldez1=" + bounds.left + "&ldez2=" + bounds.right + "&bdez1=" + bounds.top + "&bdez2=" + bounds.bottom + "&zoom=" + zoom,
					loadUrls: true
				}).then(function(content) {
					layer.clearLayers();

					content.trim().split(/\r\n|\r|\n/).slice(1).forEach(function(line) {
						var feature = line.split(/\t/);
						var iconSize = feature[4].split(",").map(function(n) { return 1*n; });
						var iconOffset = feature[5].split(",").map(function(n, i) { return iconSize[i] + 1*n; });

						var marker = L.marker([ 1*feature[0], 1*feature[1] ], {
							icon: L.icon({
								iconUrl: "https://www.freietonne.de/seekarte/" + feature[6],
								iconSize: iconSize,
								iconAnchor: iconOffset,
								popupAnchor: [ -iconOffset[0] + Math.round(iconSize[0]/2), -iconOffset[1] ]
							})
						});

						var el = $("<div/>").html(feature[2] + feature[3]);
						el.find("span:first-child").contents().unwrap().wrap("<h2></h2>");
						el.find("*").removeAttr("css");
						el.find("a").contents().unwrap();
						if(el.text().trim().length > 0)
							marker.bindPopup(el[0]);

						layer.addLayer(marker);
					});
				});
			}
		}

		var mapObj = null;
		layer.on("add", function(e) {
			mapObj = layer._map;
			mapObj.on("moveend", refresh);
			refresh();

			if(options.attribution)
				mapObj.attributionControl.addAttribution(options.attribution);
		});
		layer.on("remove", function(e) {
			mapObj.off("moveend", refresh);

			if(options.attribution)
				mapObj.attributionControl.removeAttribution(options.attribution);
		});

		return layer;
	};

	fmUtils.bboxIntersect = function(bbox1, bbox2) {
		bbox1 = L.latLngBounds(bbox1);
		bbox2 = L.latLngBounds(bbox2);
		return L.latLngBounds([
			[ Math.max(bbox1.getSouth(), bbox2.getSouth()), Math.max(bbox1.getWest(), bbox2.getWest())],
			[ Math.min(bbox1.getNorth(), bbox2.getNorth()), Math.min(bbox1.getEast(), bbox2.getEast())]
		]);
	};

	fmUtils.graticule = function(map, options) {
		var ret = new SimpleGraticule($.extend({
			redraw: "moveend",
			minDistance: 100 // Minimum distance between two lines in pixels
		}, options));

		/*var redraw = ret.redraw;
		ret.redraw = function() {
			var center = this._map.project(this._map.getCenter());
			var pixelDist = this._map.getSize().x / 20;
			var dist = Math.abs(this._map.unproject(center.subtract([ pixelDist, 0 ])).lng - this._map.unproject(center.add([ pixelDist, 0 ])).lng);

			if(dist > 45)
				this.options.interval = 45;
			else if(dist > 30)
				this.options.interval = 30;
			else {
				var fac = 1;
				while(dist>1) { fac*=10; dist/=10; }
				while(dist<=0.1) { fac/=10; dist*=10; }

				// Dist is now some number between 0.1 and 1, so we can round it conveniently and then devide it again by fac to get back to the original dist

				if(dist > 0.5)
					this.options.interval = 1/fac;
				else if(dist > 0.2)
					this.options.interval = 0.5/fac;
				else if(dist > 0.1)
					this.options.interval = 0.2/fac;
				else
					this.options.interval = 0.1/fac;
			}

			return redraw.apply(this, arguments);
		};*/

		ret.constructLines = function() {
			var bounds = this._map.getBounds();

			// Fix drawing of lines outside of bounds
			this._bounds = fmUtils.bboxIntersect(bounds, [[-85, -180], [85, 180]]);

			// Fix drawing of labels outside of bounds
			var getBoundsBkp = this._map.getBounds;
			this._map.getBounds = function() {
				return fmUtils.bboxIntersect(getBoundsBkp.apply(this, arguments), [[-85, -180], [85, 180]])
			};

			// Longitude
			var center = this._map.project(bounds.getCenter());
			var dist = niceRound(fmUtils.round(this._map.unproject(center.add([ this.options.minDistance / 2, 0 ])).lng - this._map.unproject(center.subtract([ this.options.minDistance / 2, 0 ])).lng, 12), false);
			var west = Math.max(bounds.getWest(), -180);
			var east = Math.min(bounds.getEast(), 180);
			for (var lng = Math.ceil(fmUtils.round(west/dist, 12))*dist; lng <= east; lng+=dist) {
				this.addLayer(this.buildXLine(lng));
				this.addLayer(this.buildLabel('gridlabel-horiz', fmUtils.round(lng, 12)));
			}

			// Latitude
			if(bounds.getNorth() > 0) {
				var lat = Math.max(0, bounds.getSouth());
				var first = true;
				while(lat < bounds.getNorth() && lat < 85) {
					var point = this._map.project([ lat, bounds.getCenter().lng ]);
					var point2LatLng = this._map.unproject(point.subtract([ 0, this.options.minDistance ]));

					var dist = niceRound(fmUtils.round(point2LatLng.lat - lat, 12), true);
					var lat = fmUtils.round(first ? Math.ceil(fmUtils.round(lat/dist, 12))*dist : Math.ceil(fmUtils.round(point2LatLng.lat/dist, 12))*dist, 2);

					first = false;

					this.addLayer(this.buildYLine(lat));
					this.addLayer(this.buildLabel('gridlabel-vert', lat));
				}
			}
			if(bounds.getSouth() < 0) {
				var lat = Math.min(0, bounds.getNorth());
				var first = true;
				while(lat > bounds.getSouth() && lat > -85) {
					var point = this._map.project([ lat, bounds.getCenter().lng ]);
					var point2LatLng = this._map.unproject(point.add([ 0, this.options.minDistance ]));

					var dist = niceRound(fmUtils.round(lat - point2LatLng.lat, 12), true);
					var lat = fmUtils.round(first ? Math.floor(fmUtils.round(lat/dist, 12))*dist : Math.floor(fmUtils.round(point2LatLng.lat/dist, 12))*dist, 2);

					first = false;

					this.addLayer(this.buildYLine(lat));
					this.addLayer(this.buildLabel('gridlabel-vert', lat));
				}
			}

			this._map.getBounds = getBoundsBkp;
		};

		function niceRound(number, variableDistance) {
			if(number <= 0 || !isFinite(number))
				throw "Invalid number " + number;
			else {
				if(variableDistance && number >= 5)
					return 5;
				if(number <= 10) {
					var fac = 1;
					while(number>1) { fac*=10; number/=10; }
					while(number<=0.1) { fac/=10; number*=10; }

					// Dist is now some number between 0.1 and 1, so we can round it conveniently and then multiply it again by fac to get back to the original dist

					if(number == 0.1)
						return fmUtils.round(0.1*fac, 12);
					else if(number <= 0.2)
						return fmUtils.round(0.2*fac, 12);
					else if(number <= 0.5)
						return fmUtils.round(0.5*fac, 12);
					else
						return 1*fac;
				} else if(number <= 30)
					return 30;
				else if(number <= 45)
					return 45;
				else if(number <= 60)
					return 60;
				else
					return 90;
			}
		}

		return ret;
	};

	/**
	 * Converts an object { entry: { subentry: "value" } } into { "entry.subentry": "value" }
	 * @param obj {Object}
	 * @return {Object}
	 */
	fmUtils.flattenObject = function(obj, _prefix) {
		var ret = { };
		_prefix = _prefix || "";
		for(var i in obj) {
			if(typeof obj[i] == "object")
				$.extend(ret, fmUtils.flattenObject(obj[i], _prefix + i + "."));
			else
				ret[_prefix + i] = obj[i];
		}

		return ret;
	};

	fmUtils.getObjectDiff = function(obj1, obj2) {
		var flat1 = fmUtils.flattenObject(obj1);
		var flat2 = fmUtils.flattenObject(obj2);

		var ret = [ ];

		for(var i in flat1) {
			if(flat1[i] != flat2[i] && !(!flat1[i] && !flat2[i]))
				ret.push({ index: i, before: flat1[i], after: flat2[i] });
		}

		for(var i in flat2) {
			if(!(i in flat1) && !(!flat1[i] && !flat2[i]))
				ret.push({ index: i, before: undefined, after: flat2[i] });
		}

		return ret;
	};

	/**
	 * Takes an array of track points and splits it up where two points in a row are outside of the given bbox.
	 * @param trackPoints {Array<L.LatLng>}
	 * @param bounds {L.LatLngBounds}
	 * @return {Array<Array<L.LatLng>>}
	 */
	fmUtils.disconnectSegmentsOutsideViewport = function(trackPoints, bounds) {
		let ret = [[]];
		let lastOneIn = true;
		let currentIdx = 0;

		for(let trackPoint of trackPoints) {
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
	};

	fmUtils.scrollIntoView = function(element, scrollableParent) {
		[element, scrollableParent] = [$(element), $(scrollableParent)];

		function getOffset(el) {
			let ret = 0;
			let t = el;
			while(t) {
				ret += t.offsetTop;
				t = t.offsetParent;
			}
			return ret;
		}

		let parentHeight = scrollableParent[0].clientHeight;
		let resultTop = getOffset(element[0]) - getOffset(scrollableParent[0]);
		let resultBottom = resultTop + element.outerHeight();

		if(scrollableParent[0].scrollTop > resultTop)
			scrollableParent.animate({scrollTop: resultTop});
		else if(scrollableParent[0].scrollTop < resultBottom - parentHeight)
			scrollableParent.animate({scrollTop: resultBottom - parentHeight});
	};

	fmUtils.decodeQueryString = function(str) {
		var obj = { };
		for(let segment of str.replace(/^\?/, "").split(/[;&]/)) {
			let pair = segment.split("=");
			obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
		}
		return obj;
	};

	fmUtils.encodeQueryString = function(obj) {
		let pairs = [ ];
		for(let i in obj) {
			pairs.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
		}
		return pairs.join("&");
	};

	/**
	 * Finds out whether the two coordinates are roughly equal. The two points are considered roughly equal when the
	 * projected distance between them is less than 1 pixel.
	 * @param latLng1 {L.LatLng} The first point
	 * @param latLng2 {L.LatLng} The second point
	 * @param map {L.Map} The map on which the two points are shown
	 * @param zoom {Number?} The zoom level at which the two points are shown. If not specified, the one of the map is used.
	 * @returns {boolean} Whether the two points are roughly equal.
	 */
	fmUtils.pointsEqual = function(latLng1, latLng2, map, zoom) {
		latLng1 = L.latLng(latLng1);
		latLng2 = L.latLng(latLng2);

		return map.project(latLng1, zoom).distanceTo(map.project(latLng2, zoom)) < 1;
	};

	return fmUtils;
});

fm.app.filter('fmObjectFilter', function($filter){
	return function(input, query) {
		if(!query) return input;

		var output = { };

		for(var i in input) {
			if($filter("filter")([ input[i] ], query).length == 1)
				output[i] = input[i];
		}

		return output;
	};
});

fm.app.filter('fmPropertyCount', function($filter) {
	return function(input, query) {
		if(!input)
			return 0;
		else if(!query)
			return Object.keys(input).length;
		else
			return Object.keys($filter('fmObjectFilter')(input, query)).length;
	};
});

fm.app.filter('fmRenderOsmTag', function($sce, fmUtils) {
	return function(value, key) {
		[key, value] = [`${key}`, `${value}`];
		if(key.match(/^wikipedia(:|$)/)) {
			return $sce.trustAsHtml(value.split(";").map(function(it) {
				var m = it.match(/^(\s*)((([-a-z]+):)?(.*))(\s*)$/);
				var url = "https://" + (m[4] || "en") + ".wikipedia.org/wiki/" + m[5];
				return m[1] + '<a href="' + fmUtils.quoteHtml(url) + '" target="_blank">' + fmUtils.quoteHtml(m[2]) + '</a>' + m[6];
			}).join(";"));
		} else if(key.match(/^wikidata(:|$)/)) {
			return $sce.trustAsHtml(value.split(";").map(function(it) {
				var m = it.match(/^(\s*)(.*?)(\s*)$/);
				return m[1] + '<a href="https://www.wikidata.org/wiki/' + fmUtils.quoteHtml(m[2]) + '" target="_blank">' + fmUtils.quoteHtml(m[2]) + '</a>' + m[3];
			}).join(";"));
		} else if(key.match(/^wiki:symbol(:$)/)) {
			return $sce.trustAsHtml(value.split(";").map(function(it) {
				var m = it.match(/^(\s*)(.*?)(\s*)$/);
				return m[1] + '<a href="https://wiki.openstreetmap.org/wiki/Image:' + fmUtils.quoteHtml(m[2]) + '" target="_blank">' + fmUtils.quoteHtml(m[2]) + '</a>' + m[3];
			})).join(";");
		} else {
			return $sce.trustAsHtml(linkifyStr(value));
		}
	};
});

fm.app.filter('fmNumberArray', function() {
	return function(value, key) {
		var ret = [ ];
		for(var i=0; i<value; i++)
			ret.push(i);
		return ret;
	};
});

fm.app.filter('fmRound', function(fmUtils) {
	return function(value, key) {
		return fmUtils.round(value, key);
	};
});

fm.app.filter('fmFormatTime', function(fmUtils) {
	return function(value, key) {
		return fmUtils.formatTime(value);
	};
});

fm.app.filter('fmRoutingMode', function(fmUtils) {
	return function(value) {
		return fmUtils.routingMode(value);
	};
});

fm.app.filter('fmOrderBy', function($filter) {
	return function(value, key) {
		return $filter('orderBy')(Object.keys(value).map(function(i) { return value[i]; }), key);
	};
});
