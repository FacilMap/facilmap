var FacilPad = {
	SERVER : "http://localhost:40829",
	map : null,
	socket : null,
	layerMarkers : null,
	clickListeners : [ ],
	onMove : null,
	onMoveEnd : null,
	markersById : { },
	onClickMarker : null,
	linesById : { },
	onClickLine : null
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

			"loadMap" : [ "FacilMap", loadMap ],
			"jQuery" : [ "FacilMap", function(next) {
				jQuery = $ = FacilMap.$;
				next();
			}],
			"ng" : [ "angular", "jQuery", "socketIo", "loadMap", "marked", loadJavaScript.bind(null, "js/ng.js") ]
		});
	});

	function loadMap(callback) {
		fp.map = new FacilMap.Map("map");
		fp.map.addAllAvailableLayers();

		//fp.layerMarkers = new FacilMap.Layer.Markers("Markers", { displayInLayerSwitcher: false });
		//fp.map.addLayer(fp.layerMarkers);

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
				obj.fpOnClick(fp.xyToPos(fp.featureHandler.fpXy));
			}
		}, { map: fp.map });
		var handleBkp = fp.featureHandler.handle;
		fp.featureHandler.handle = function(e) {
			if(e.type == "click")
				this.fpXy = new OpenLayers.Pixel(e.x, e.y);

			return handleBkp.apply(this, arguments);
		};
		fp.featureHandler.activate();

		fp.map.events.register("click", map, function(e) {
			var listener = fp.clickListeners.shift();

			if(fp.clickListeners.length == 0) {
				$(fp.map.div).removeClass("fp-clickHandler");
				fp.featureHandler.activate();
			}

			listener && listener(fp.xyToPos(e.xy));
		});

		fp.map.events.register("move", this, function() {
			fp.onMove();
		});

		fp.map.events.register("moveend", this, function(){
			var x = fp.map.getExtent().clone().transform(fp.map.getProjectionObject(), _p());
			fp.onMoveEnd({ top: x.top, left: x.left, bottom: x.bottom, right: x.right });
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
		var ret = {
			view: fp.map.getExtent().clone().transform(fp.map.getProjectionObject(), _p()),
			baseLayer: fp.map.baseLayer.permalinkName,
			layers: [ ]
		};
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
			var bbox = OpenLayers.Bounds.prototype.clone.apply(view.view).transform(_p(), fp.map.getProjectionObject());
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
			externalGraphic: "img/marker-"+marker.style+".png",
			graphicWidth: 21,
			graphicHeight: 25,
			graphicXOffset: -9,
			graphicYOffset: -25
		};
		var feature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(marker.position.lon, marker.position.lat).transform(_p(), fp.map.getProjectionObject()), null, style);
		feature.fpOnClick = function() {
			fp.onClickMarker(marker);
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

		if(line.actualPoints.length < 2)
			return;

		var style = {
			strokeColor : '#'+line.colour,
			strokeWidth : line.width,
			strokeOpacity : 0.7
		};

		var points = [ ];
		for(var i=0; i<line.actualPoints.length; i++) {
			points.push(new OpenLayers.Geometry.Point(line.actualPoints[i].lon, line.actualPoints[i].lat));
		}
		var feature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString(points).transform(_p(), fp.map.getProjectionObject()), null, style);
		feature.fpOnClick = function(clickPos) {
			fp.onClickLine(line, clickPos);
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
		fp.featureHandler.deactivate();
		fp.clickListeners.push(listener);
		$(fp.map.div).addClass("fp-clickHandler");
	};

	fp.xyToPos = function(xy) {
		return fp.map.getLonLatFromViewPortPx(xy).clone().transform(fp.map.getProjectionObject(), _p());
	};

	fp.posToXy = function(pos) {
		var lonlat = new OpenLayers.LonLat(pos.lon, pos.lat).transform(_p(), fp.map.getProjectionObject());
		return fp.map.getViewPortPxFromLonLat(lonlat);
	};

})(FacilPad);