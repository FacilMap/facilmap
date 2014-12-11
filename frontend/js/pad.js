var FacilPad = {
	SERVER : "http://localhost:40829",
	COLOURS : [ "ffffff", "ffccc9", "ffce93", "fffc9e", "ffffc7", "9aff99", "96fffb", "cdffff", "cbcefb", "cfcfcf", "fd6864",
		"fe996b", "fffe65", "fcff2f", "67fd9a", "38fff8", "68fdff", "9698ed", "c0c0c0", "fe0000", "f8a102", "ffcc67", "f8ff00", "34ff34",
		"68cbd0", "34cdf9", "6665cd", "9b9b9b", "cb0000", "f56b00", "ffcb2f", "ffc702", "32cb00", "00d2cb", "3166ff", "6434fc", "656565",
		"9a0000", "ce6301", "cd9934", "999903", "009901", "329a9d", "3531ff", "6200c9", "343434", "680100", "963400", "986536", "646809",
		"036400", "34696d", "00009b", "303498", "000000", "330001", "643403", "663234", "343300", "013300", "003532", "010066", "340096" ],
	map : null,
	socket : null,
	markersById : { },
	linesById : { },
	mapEvents : null /* Event types: clickMarker, clickLine, click, move, moveEnd, mouseMove */
};

(function(fp) {

	var $;

	if(Function.prototype.bind == null) {
		Function.prototype.bind = function(context) {
			var args = Array.prototype.slice.call(arguments, 1);
			var func = this;

			return function() {
				var newArgs = args.concat(Array.prototype.slice.call(arguments));
				return func.apply(context, newArgs);
			}
		};
	}

	loadJavaScript("lib/async-0.6.2.min.js", function() {
		async.auto({
			"FacilMap" : loadJavaScript.bind(null, "https://api.facilmap.org/facilmap_ol_src.js"),
			"angular" : loadJavaScript.bind(null, "lib/angular-1.2.16.min.js"),
			"socketIo" : loadJavaScript.bind(null, fp.SERVER+"/socket.io/socket.io.js"),
			"marked" : loadJavaScript.bind(null, "lib/marked-0.3.2.min.js"),
			"jqSpinner" : [ "jQuery", loadJavaScript.bind(null, "lib/jquery.ui.spinner-1.10.4.min.js") ],

			"jQuery" : [ "FacilMap", function(next) {
				jQuery = $ = FacilMap.$;
				next();
			}],
			"ready" : [ "jQuery", function(next) {
				$(document).ready(function() { next(); })
			}],

			"loadMap" : [ "FacilMap", "ready", "jQuery", loadMap ],
			"ng" : [ "angular", "jQuery", "socketIo", "loadMap", "marked", "jqSpinner", loadJavaScript.bind(null, "js/ng.js") ]
		});
	});

	function loadMap(callback) {
		var fm = FacilMap;
		var ol = OpenLayers;

		fp.mapEvents = $("<span/>");

		$("button,input[type=submit],input[type=button],input[type=reset]").button();

		fp.map = new FacilMap.Map("map");

		// Deal with z-indexes: Popups should be below map controls
		$("#view-marker-popup,#view-line-popup").appendTo(fp.map.viewPortDiv);

		fp.map.addLayer(new fm.Layer.OSM.Mapnik(ol.i18n("Mapnik"), { permalinkName : "Mpnk" }));
		fp.map.addLayer(new fm.Layer.OSM.MapSurfer.Road(ol.i18n("MapSurfer Road"), { permalinkName : "MSfR" }));
		fp.map.addLayer(new fm.Layer.OSM.CycleMap(ol.i18n("OpenCycleMap"), { permalinkName : "OCyc" }));
		fp.map.addLayer(new fm.Layer.OSM.HikeAndBike(ol.i18n("Hike & Bike Map"), { permalinkName : "HiBi" }));
		fp.map.addLayer(new fm.Layer.OSM.OpenPTMap(ol.i18n("Public transportation"), { permalinkName : "OPTM", visibility : false }));
		fp.map.addLayer(new fm.Layer.other.Relief(ol.i18n("Relief"), { visibility: false, permalinkName : "Rlie" }));

		fp.layerLines = new OpenLayers.Layer.Vector("Lines", { displayInLayerSwitcher: false, visibility: true });
		fp.map.addLayer(fp.layerLines);

		fp.featureHandler = new OpenLayers.Handler.Feature(null, fp.layerLines, {
			"over" : function() {
				$(fp.map.div).addClass("fp-overFeature");
			},
			"out" : function() {
				$(fp.map.div).removeClass("fp-overFeature");
			},
			"click" : function(obj) {
				obj.fpOnClick(fp.xyToPos(fp.featureHandler.up));
			}
		}, { map: fp.map });
		fp.featureHandler.activate();

		fp.map.events.register("click", map, function(e) {
			fp.mapEvents.trigger("click", [ fp.xyToPos(e.xy) ]);
		});

		fp.map.events.register("move", this, function() {
			setTimeout(function() { fp.mapEvents.trigger("move"); }, 0);
		});

		fp.map.events.register("moveend", this, function() {
			var x = fp.map.getExtent().clone().transform(fp.map.getProjectionObject(), _p());
			setTimeout(function() {
				fp.mapEvents.trigger("moveEnd", [ { top: x.top, left: x.left, bottom: x.bottom, right: x.right, zoom: fp.map.getZoom() } ]);
			}, 0);
		});

		fp.map.events.register("mousemove", this, function(e) {
			fp.mapEvents.trigger("mouseMove", [ fp.xyToPos(e.xy) ]);
		});


		function _wrapFeatureFunc(superFunc) {
			return function(feature) {
				if(this.filterFunc(feature))
					return superFunc.apply(this, arguments);
			};
		}

		fp.DragFeature = new OpenLayers.Class(OpenLayers.Control.DragFeature, {
			filterFunc : null,

			initialize : function(layer, filterFunc, options) {
				this.filterFunc = filterFunc || function(feature) { return true; };

				OpenLayers.Control.DragFeature.prototype.initialize.apply(this, [ layer, options ]);
			},

			clickFeature : _wrapFeatureFunc(OpenLayers.Control.DragFeature.prototype.clickFeature),
			clickoutFeature : _wrapFeatureFunc(OpenLayers.Control.DragFeature.prototype.clickoutFeature),
			overFeature : _wrapFeatureFunc(OpenLayers.Control.DragFeature.prototype.overFeature),
			outFeature : _wrapFeatureFunc(OpenLayers.Control.DragFeature.prototype.outFeature)
		});


		callback();
	}

	// From http://stackoverflow.com/a/4845802/242365
	function loadJavaScript(url, callback) {
		var head = document.getElementsByTagName("head")[0] || document.documentElement;
		var script = document.createElement("script");
		script.src = url;

		// Handle Script loading
	    var done = false;

		// Attach handlers for all browsers
		script.onload = script.onreadystatechange = function() {
		    if(!done && (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") ) {
		        done = true;
		        callback();

		        // Handle memory leak in IE
		        script.onload = script.onreadystatechange = null;
		        if(head && script.parentNode) {
		            head.removeChild(script);
		        }
		    }
		};

		// Use insertBefore instead of appendChild  to circumvent an IE6 bug.
		// This arises when a base node is used (#2709 and #4378).
		head.insertBefore(script, head.firstChild);
	}

	function _p() {
		return new OpenLayers.Projection("EPSG:4326");
	}

	fp.getCurrentView = function() {
		var ret = fp.map.getExtent().clone().transform(fp.map.getProjectionObject(), _p());

		ret.baseLayer = fp.map.baseLayer.permalinkName;
		ret.layers = [ ];

		for(var i=0; i<fp.map.layers.length; i++) {
			if(!fp.map.layers[i].isBaseLayer && fp.map.layers[i].displayInLayerSwitcher && fp.map.layers[i].visibility)
				ret.layers.push(fp.map.layers[i].permalinkName || fp.map.layers[i].name);
		}

		return ret;
	};

	fp.displayView = function(view) {
		if(view == null) {
			fp.map.zoomToMaxExtent();
		} else {
			var bbox = OpenLayers.Bounds.prototype.clone.apply(view).transform(_p(), fp.map.getProjectionObject());
			fp.map.zoomToExtent(bbox);

			var matching_layers = fp.map.getLayersBy("permalinkName", view.baseLayer);
			if(matching_layers.length == 0)
				matching_layers = fp.map.getLayersBy("name", view.baseLayer);
			if(matching_layers.length > 0)
				fp.map.setBaseLayer(matching_layers[0]);

			for(var i=0; i<fp.map.layers.length; i++) {
				if(!fp.map.layers[i].isBaseLayer && fp.map.layers[i].displayInLayerSwitcher)
					fp.map.layers[i].setVisibility(view.layers.indexOf(fp.map.layers[i].permalinkName) != -1 || view.layers.indexOf(fp.map.layers[i].name) != -1);
			}
		}
	};

	fp.addMarker = function(marker) {
		fp.deleteMarker(marker);

		var style = {
			externalGraphic: fp.createMarkerGraphic(marker.colour),
			graphicWidth: 21,
			graphicHeight: 25,
			graphicXOffset: -9,
			graphicYOffset: -25
		};
		var feature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(marker.lon, marker.lat).transform(_p(), fp.map.getProjectionObject()), null, style);
		feature.fpMarker = marker;
		feature.fpOnClick = function() {
			fp.mapEvents.trigger("clickMarker", [ marker ]);
		};
		fp.layerLines.addFeatures([ feature ]);
		fp.markersById[marker.id] = feature;
	};

	fp.deleteMarker = function(marker) {
		var markerObj = fp.markersById[marker.id];
		if(!markerObj)
			return;

		delete fp.markersById[marker.id];
		fp.layerLines.removeFeatures([ markerObj ]);
	};

	fp.addLine = function(line) {
		fp.deleteLine(line);

		if(!line.actualPoints || line.actualPoints.length < 2)
			return;

		var points = [ ];
		for(var i=0; i<line.actualPoints.length; i++) {
			if(line.actualPoints[i] != null)
				points.push(new OpenLayers.Geometry.Point(line.actualPoints[i].lon, line.actualPoints[i].lat));
		}

		if(points.length < 2)
			return;

		var style = {
			strokeColor : '#'+line.colour,
			strokeWidth : line.width,
			strokeOpacity : 0.7
		};

		var feature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString(points).transform(_p(), fp.map.getProjectionObject()), null, style);
		feature.fpOnClick = function(clickPos) {
			fp.mapEvents.trigger("clickLine", [ line, clickPos ]);
		};
		fp.layerLines.addFeatures([ feature ]);
		fp.linesById[line.id] = feature;
	};

	fp.deleteLine = function(line) {
		var lineObj = fp.linesById[line.id];
		if(!lineObj)
			return;

		delete fp.linesById[line.id];
		fp.layerLines.removeFeatures([lineObj]);
	};

	fp.addClickListener = function(listener) {
		fp.featureHandler.deactivate(); // Disable clicking on markers and lines
		$(fp.map.div).addClass("fp-clickHandler");

		var ret = {
			cancel: function() {
				fp.mapEvents.off("click", handler);
				$(fp.map.div).removeClass("fp-clickHandler");
				fp.featureHandler.activate();
			}
		};

		function handler(e, pos) {
			ret.cancel();
			listener(pos);
		}

		setTimeout(function() {
			fp.mapEvents.on("click", handler);
		}, 0);

		return ret;
	};

	fp.xyToPos = function(xy) {
		return fp.map.getLonLatFromViewPortPx(xy).clone().transform(fp.map.getProjectionObject(), _p());
	};

	fp.posToXy = function(pos) {
		var lonlat = new OpenLayers.LonLat(pos.lon, pos.lat).transform(_p(), fp.map.getProjectionObject());
		return fp.map.getViewPortPxFromLonLat(lonlat);
	};

	fp.getLayerInfo = function() {
		var ret = [ ];
		fp.map.layers.forEach(function(it) {
			if(!it.displayInLayerSwitcher)
				return;
			ret.push({ isBaseLayer: it.isBaseLayer, visibility: it.getVisibility(), name: it.name, permalinkName: it.permalinkName });
		});
		return ret;
	};

	fp.showLayer = function(permalinkName, show) {
		var layers = fp.map.getLayersBy("permalinkName", permalinkName);
		if(layers.length == 0)
			return;

		if(layers[0].isBaseLayer && show)
			fp.map.setBaseLayer(layers[0]);
		else
			layers[0].setVisibility(show);
	};

	fp.makeLineMovable = function(origLine) {
		fp.featureHandler.deactivate();

		var line = $.extend(true, { }, origLine);

		line.actualPoints = line.points;
		fp.addLine(line);

		var markers = [ ];
		drawMarkers();

		var drag = new fp.DragFeature(fp.layerLines, function(feature) {
			return feature.fpMarker && feature.fpMarker.id.match(/^linePoint/);
		}, {
			onDrag : function(feature) {
				line.points[feature.fpMarker.i] = new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y).transform(fp.map.getProjectionObject(), _p());
				fp.addLine(line);
			}
		});
		fp.map.addControl(drag);
		drag.activate();

		return {
			done : function() {
				end();
				return line.points;
			}
		};

		function drawMarkers(end) {
			for(var i=0; i<markers.length; i++)
				fp.deleteMarker(markers[i]);
			markers = [ ];

			if(!end) {
				for(var i=0; i<line.points.length; i++) {
					var marker = { id: "linePoint"+i, lat: line.points[i].lat, lon: line.points[i].lon, colour: "ffd700", i: i };
					markers.push(marker);
					fp.addMarker(marker);
				}
			}
		}

		function end() {
			drawMarkers(true);
			drag.deactivate();
			fp.map.removeControl(drag);
			fp.featureHandler.activate();
		}
	};

	var LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	var LENGTH = 12;

	fp.generateRandomPadId = function() {
		var randomPadId = "";
		for(var i=0; i<LENGTH; i++) {
			randomPadId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
		}
		return randomPadId;
	};

	fp.createMarkerGraphic = function(colour) {
		var borderColour = fp.makeTextColour(colour, 0.3);

		var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
			'<svg xmlns="http://www.w3.org/2000/svg" width="21" height="25" version="1.1">' +
			'<g transform="matrix(0.962318,0,0,0.962318,0.35255058,-988.3149)">' +
			'<path style="fill:#' + colour + ';stroke:#' + borderColour + ';stroke-width:1" d="m 0.31494999,1035.8432 10.20437901,-8.1661 10.20438,8.1661 -10.20438,16.204 z" />' +
			'<path style="fill:#' + borderColour + ';stroke:none" d="m 361.63462,62.160149 c 0,10.181526 -8.25375,18.435283 -18.43528,18.435283 -10.18153,0 -18.43528,-8.253757 -18.43528,-18.435283 0,-10.181526 8.25375,-18.435284 18.43528,-18.435284 10.18153,0 18.43528,8.253758 18.43528,18.435284 z" transform="matrix(0.1366727,0,0,0.1366727,-36.38665,1028.6074)" />' +
			'</g>' +
			'</svg>';

		return "data:image/svg+xml;base64,"+btoa(svg);
	};

	fp.makeTextColour = function(backgroundColour, threshold) {
		if(threshold == null)
			threshold = 0.5;

		var r = parseInt(backgroundColour.substr(0, 2), 16)/255;
		var g = parseInt(backgroundColour.substr(2, 2), 16)/255;
		var b = parseInt(backgroundColour.substr(4, 2), 16)/255;
		// See http://stackoverflow.com/a/596243/242365
		return (Math.sqrt(0.241*r*r + 0.691*g*g + 0.068*b*b) <= threshold) ? "ffffff" : "000000";
	};

	fp.padId = location.pathname.match(/[^\/]*$/)[0];

})(FacilPad);