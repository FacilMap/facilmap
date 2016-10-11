(function(fp, $, ng, undefined) {

	fp.app.factory("fpUtils", function($parse, L) {

		var fpUtils = { };

		var LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		var LENGTH = 12;

		fpUtils.generateRandomPadId = function(length) {
			if(length == null)
				length = LENGTH;

			var randomPadId = "";
			for(var i=0; i<length; i++) {
				randomPadId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
			}
			return randomPadId;
		};

		fpUtils.createMarkerGraphic = function(colour, huge, randomTrash) {
			var borderColour = fpUtils.makeTextColour(colour, 0.3);

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

		fpUtils.createMarkerIcon = function(colour, huge) {
			return L.icon({
				iconUrl: fpUtils.createMarkerGraphic(colour, huge),
				iconSize: huge ? [10000, 10000] : [21, 25],
				iconAnchor: huge ? [5010, 5025] : [10, 25],
				popupAnchor: [0, -25]
			});
		};

		fpUtils.makeTextColour = function(backgroundColour, threshold) {
			if(threshold == null)
				threshold = 0.5;

			var r = parseInt(backgroundColour.substr(0, 2), 16)/255;
			var g = parseInt(backgroundColour.substr(2, 2), 16)/255;
			var b = parseInt(backgroundColour.substr(4, 2), 16)/255;
			// See http://stackoverflow.com/a/596243/242365
			return (Math.sqrt(0.241*r*r + 0.691*g*g + 0.068*b*b) <= threshold) ? "ffffff" : "000000";
		};

		fpUtils.overwriteObject = function(from, to) {
			for(var i in to)
				delete to[i];
			for(var i in from)
				to[i] = from[i];
		};

		fpUtils.quoteJavaScript = function(str) {
			return "'" + (""+str).replace(/['\\]/g, '\\\1').replace(/\n/g, "\\n") + "'";
		};

		fpUtils.quoteHtml = function(str) {
			return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
		};

		fpUtils.round = function(number, digits) {
			var fac = Math.pow(10, digits);
			return Math.round(number*fac)/fac;
		};

		fpUtils.formatTime = function(seconds) {
			var hours = Math.floor(seconds/3600);
			var minutes = Math.floor((seconds%3600)/60);
			if(minutes < 10)
				minutes = "0" + minutes;
			return hours + ":" + minutes;
		};

		fpUtils.routingMode = function(mode) {
			switch(mode) {
				case "fastest":
				case "shortest":
					return "by car";
				case "bicycle":
					return "by bicycle";
				case "pedestrian":
					return "by foot";
				default:
					return "";
			}
		};

		fpUtils.preserveObject = function(scope, sourceExpr, targetExpr, onDelete) {
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

					fpUtils.overwriteObject(bkp, obj);
					unwatch();
				},
				leave : function() {
					unwatch();
					bkp = null;
				}
			}
		};

		fpUtils.leafletToFpBbox = function(bbox, zoom) {
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

		fpUtils.fpToLeafletBbox = function(bbox) {
			return L.latLngBounds(L.latLng(bbox.bottom, bbox.left), L.latLng(bbox.top, bbox.right));
		};

		fpUtils.getClosestIndexOnLine = function(map, trackPoints, point, startI) {
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

		fpUtils.getIndexOnLine = function(map, trackPoints, routePoints, point) {
			if(routePoints.length == 0)
				return 0;

			var idxs = [ ];
			for(var i=0; i<routePoints.length; i++) {
				idxs.push(fpUtils.getClosestIndexOnLine(map, trackPoints, routePoints[i], idxs[i-1]));
			}

			var pointIdx = fpUtils.getClosestIndexOnLine(map, trackPoints, point);

			if(pointIdx == 0)
				return 0;

			for(var i=0; i<idxs.length; i++) {
				if(idxs[i] > pointIdx)
					return i;
			}
			return idxs.length;
		};

		return fpUtils;
	});

	fp.app.filter('fpObjectFilter', function($filter){
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

	fp.app.filter('fpPropertyCount', function($filter) {
		return function(input, query) {
			return Object.keys($filter('fpObjectFilter')(input, query)).length;
		};
	});

	fp.app.filter('fpRenderOsmTag', function($sce, linkifyStr, fpUtils) {
		return function(value, key) {
			if(key.match(/^wikipedia(:|$)/)) {
				return $sce.trustAsHtml(value.split(";").map(function(it) {
					var m = it.match(/^(\s*)((([-a-z]+):)?(.*))(\s*)$/);
					var url = "https://" + (m[4] || "en") + ".wikipedia.org/wiki/" + m[5];
					return m[1] + '<a href="' + fpUtils.quoteHtml(url) + '" target="_blank">' + fpUtils.quoteHtml(m[2]) + '</a>' + m[6];
				}).join(";"));
			} else if(key.match(/^wikidata(:|$)/)) {
				return $sce.trustAsHtml(value.split(";").map(function(it) {
					var m = it.match(/^(\s*)(.*?)(\s*)$/);
					return m[1] + '<a href="https://www.wikidata.org/wiki/' + fpUtils.quoteHtml(m[2]) + '" target="_blank">' + fpUtils.quoteHtml(m[2]) + '</a>' + m[3];
				}).join(";"));
			} else {
				return $sce.trustAsHtml(linkifyStr(value));
			}
		};
	});

})(FacilPad, jQuery, angular);