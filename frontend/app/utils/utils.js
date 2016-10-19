(function(fm, $, ng, undefined) {

	fm.app.factory("fmUtils", function($parse, L, Clipboard) {

		var fmUtils = { };

		var LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		var LENGTH = 12;

		var shortLinkCharArray = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_@";

		fmUtils.generateRandomPadId = function(length) {
			if(length == null)
				length = LENGTH;

			var randomPadId = "";
			for(var i=0; i<length; i++) {
				randomPadId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
			}
			return randomPadId;
		};

		fmUtils.createMarkerGraphic = function(colour, huge, randomTrash) {
			var borderColour = fmUtils.makeTextColour(colour, 0.3);

			var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
				'<svg xmlns="http://www.w3.org/2000/svg" width="' + (huge ? 10000 : 21) + '" height="' + (huge ? 10000 : 25) + '" version="1.1">' +
				(randomTrash ? '<!--' + randomTrash + '-->' : '') + // Chrome seems to have a bug where it applies the CSS styles of one image the same code
				(huge ? '<g transform="matrix(1,0,0,1,5000,5000)">' : '') +
				'<path style="fill:#' + colour + ';stroke:#' + borderColour + ';stroke-width:1" d="M 0.65579587,8.5137553 10.493963,0.66460903 20.332132,8.5137553 10.493963,24.088823 Z" />' +
				'<path style="fill:#' + borderColour + ';stroke:none" d="m 12.953591,9.6886404 c 0,1.3406746 -1.090141,2.4275066 -2.434898,2.4275066 -1.3447591,0 -2.4348995,-1.086832 -2.4348995,-2.4275066 0,-1.3406751 1.0901404,-2.4275068 2.4348995,-2.4275068 1.344757,0 2.434898,1.0868317 2.434898,2.4275068 z" />' +
				(huge ? '</g>' : '') +
				'</svg>';

			return "data:image/svg+xml;base64,"+btoa(svg);
		};

		fmUtils.createMarkerIcon = function(colour, huge) {
			return L.icon({
				iconUrl: fmUtils.createMarkerGraphic(colour, huge),
				iconSize: huge ? [10000, 10000] : [21, 25],
				iconAnchor: huge ? [5010, 5025] : [10, 25],
				popupAnchor: [0, -25]
			});
		};

		fmUtils.makeTextColour = function(backgroundColour, threshold) {
			if(threshold == null)
				threshold = 0.5;

			var r = parseInt(backgroundColour.substr(0, 2), 16)/255;
			var g = parseInt(backgroundColour.substr(2, 2), 16)/255;
			var b = parseInt(backgroundColour.substr(4, 2), 16)/255;
			// See http://stackoverflow.com/a/596243/242365
			return (Math.sqrt(0.241*r*r + 0.691*g*g + 0.068*b*b) <= threshold) ? "ffffff" : "000000";
		};

		fmUtils.overwriteObject = function(from, to) {
			for(var i in to)
				delete to[i];
			for(var i in from)
				to[i] = from[i];
		};

		fmUtils.quoteJavaScript = function(str) {
			return "'" + (""+str).replace(/['\\]/g, '\\\1').replace(/\n/g, "\\n") + "'";
		};

		fmUtils.quoteHtml = function(str) {
			return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
		};

		fmUtils.round = function(number, digits) {
			var fac = Math.pow(10, digits);
			return Math.round(number*fac)/fac;
		};

		fmUtils.formatTime = function(seconds) {
			var hours = Math.floor(seconds/3600);
			var minutes = Math.floor((seconds%3600)/60);
			if(minutes < 10)
				minutes = "0" + minutes;
			return hours + ":" + minutes;
		};

		fmUtils.routingMode = function(mode) {
			switch(mode) {
				case "car":
					return "by car";
				case "bicycle":
					return "by bicycle";
				case "pedestrian":
					return "by foot";
				default:
					return "";
			}
		};

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

		fmUtils.temporaryDragMarker = function(map, line, colour, callback) {
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

			line.on("fm-almostover", _over).on("fm-almostmove", _move).on("fm-almostout", _out);

			function makeTemporaryHoverMarker() {
				temporaryHoverMarker = L.marker([0,0], {
					icon: fmUtils.createMarkerIcon(colour, true),
					draggable: true
				}).once("dragstart", function() {
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
				line.off("fm-almostover", _over).off("fm-almostmove", _move).off("fm-almostout", _out);
				temporaryHoverMarker.remove();
			};
		};

		fmUtils.splitRouteQuery = function(query) {
			var queries = [ ];

			var spl = query.split(/\s+to\s+/);
			spl.forEach(function(it, i1) {
				var spl2 = it.split(/\s+via\s+/);

				spl2.forEach(function(it2, i2) {
					if(i1 == spl.length-1 && i2 != 0)
						queries.splice(-1, 0, it2); // vias after the last to should be inserted before the last to (Berlin to Hamburg via Munich should become Berlin, Munich, Hamburg)
					else
						queries.push(it2);
				})
			});
			return queries;
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

		fmUtils.onLongClick = function(map, callback) {
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
			return Object.keys($filter('fmObjectFilter')(input, query)).length;
		};
	});

	fm.app.filter('fmRenderOsmTag', function($sce, linkifyStr, fmUtils) {
		return function(value, key) {
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

})(FacilMap, jQuery, angular);