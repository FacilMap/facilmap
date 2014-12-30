(function(fp, $, ng, fm, ol, undefined) {

	fp.app.directive("fpMap", [ "fpMap", function(fpMap) {
		return {
			restrict: 'EA',
			link: function(scope, element, attrs) {
				fpMap.initMap(element, attrs.id, attrs.fpPadId);
			}
		};
	} ]);

	fp.app.factory("fpMap", [ "fpUtils", "fpSocket", "fpMapMessages", "fpDialogs", "fpMapMarkers", "fpMapPopups", "$templateCache", "$compile", "fpMapLines", "fpMapTypes", "fpMapViews", "$rootScope", "fpMapPad", "fpMapToolbox", "$timeout", "fpMapLegend", "fpMapSearch", function(fpUtils, fpSocket, fpMapMessages, fpDialogs, fpMapMarkers, fpMapPopups, $templateCache, $compile, fpMapLines, fpMapTypes, fpMapViews, $rootScope, fpMapPad, fpMapToolbox, $timeout, fpMapLegend, fpMapSearch) {
		var maps = { };

		var ret = { };
		
		ret.getMap = function(id) {
			return maps[id];
		};

		ret.initMap = function(el, id, padId) {
			return maps[id] = new Map(el, id, padId);
		};

		return ret;

		function Map(replaceEl, id, padId) {
			var map = this;

			map.mapEvents = $rootScope.$new(true); /* Event types: clickMarker, clickLine, click, move, moveEnd, mouseMove */
			map.socket = fpSocket(map, padId);
			map.socket.id = id; // To be in scope for template

			map.markersById = { };
			map.linesById = { };

			var el = $($templateCache.get("map.html"));
			replaceEl.replaceWith(el);
			$compile(el)(map.socket);

			map.map = new FacilMap.Map(el[0]);

			// Map ID is not set yet as scope is not digested. So styles might change.
			$timeout(map.map.updateSize.bind(map.map));

			map.map.addLayer(new fm.Layer.OSM.Mapnik(ol.i18n("Mapnik"), { permalinkName : "Mpnk" }));
			map.map.addLayer(new fm.Layer.OSM.MapSurfer.Road(ol.i18n("MapSurfer Road"), { permalinkName : "MSfR" }));
			map.map.addLayer(new fm.Layer.OSM.CycleMap(ol.i18n("OpenCycleMap"), { permalinkName : "OCyc" }));
			map.map.addLayer(new fm.Layer.OSM.HikeAndBike(ol.i18n("Hike & Bike Map"), { permalinkName : "HiBi" }));
			map.map.addLayer(new fm.Layer.OSM.OpenPTMap(ol.i18n("Public transportation"), { permalinkName : "OPTM", visibility : false }));
			map.map.addLayer(new fm.Layer.other.Relief(ol.i18n("Relief"), { visibility: false, permalinkName : "Rlie" }));

			map.layerLines = new OpenLayers.Layer.Vector("Lines", { displayInLayerSwitcher: false, visibility: true });
			map.map.addLayer(map.layerLines);

			map.featureHandler = new OpenLayers.Handler.Feature(null, map.layerLines, {
				"over" : function(obj) {
					$(map.map.div).addClass("fp-overFeature");

					if(!obj.fpLabel) {
						if(obj.fpMarker && obj.fpMarker.name)
							obj.fpLabel = map.showLabel(obj.fpMarker.name, obj.fpMarker, { x: 10, y: 0 });
						else if(obj.fpLine && obj.fpLine.name)
							obj.fpLabel = map.showLabel(obj.fpLine.name, map.xyToPos(map.featureHandler.evt), { x: 15, y: 0 }, true);
					}
				},
				"out" : function(obj) {
					$(map.map.div).removeClass("fp-overFeature");

					if(obj.fpLabel) {
						obj.fpLabel.close();
						obj.fpLabel = null;
					}
				},
				"click" : function(obj) {
					obj.fpOnClick(map.xyToPos(map.featureHandler.up));
				}
			}, { map: map.map });
			map.featureHandler.activate();

			map.map.events.register("click", map.map, function(e) {
				map.mapEvents.$emit("click", map.xyToPos(e.xy));
			});

			map.map.events.register("move", this, function() {
				setTimeout(function() { map.mapEvents.$emit("move"); }, 0);
			});

			map.map.events.register("moveend", this, function() {
				var x = map.map.getExtent().clone().transform(map.map.getProjectionObject(), fpUtils.proj());
				setTimeout(function() {
					map.mapEvents.$emit("moveEnd", { top: x.top, left: x.left, bottom: x.bottom, right: x.right, zoom: map.map.getZoom() });
				}, 0);
			});

			map.map.events.register("mousemove", this, function(e) {
				map.mapEvents.$emit("mouseMove", map.xyToPos(e.xy));
			});

			function _wrapFeatureFunc(superFunc) {
				return function(feature) {
					if(this.filterFunc(feature))
						return superFunc.apply(this, arguments);
				};
			}

			map.DragFeature = new OpenLayers.Class(OpenLayers.Control.DragFeature, {
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

			map.getCurrentView = function() {
				var ret = map.map.getExtent().clone().transform(map.map.getProjectionObject(), fpUtils.proj());

				ret.baseLayer = map.map.baseLayer.permalinkName;
				ret.layers = [ ];

				for(var i=0; i<map.map.layers.length; i++) {
					if(!map.map.layers[i].isBaseLayer && map.map.layers[i].displayInLayerSwitcher && map.map.layers[i].visibility)
						ret.layers.push(map.map.layers[i].permalinkName || map.map.layers[i].name);
				}

				return ret;
			};

			map.displayView = function(view) {
				if(view == null) {
					map.map.zoomToMaxExtent();
				} else {
					var bbox = OpenLayers.Bounds.prototype.clone.apply(view).transform(fpUtils.proj(), map.map.getProjectionObject());
					map.map.zoomToExtent(bbox);

					var matching_layers = map.map.getLayersBy("permalinkName", view.baseLayer);
					if(matching_layers.length == 0)
						matching_layers = map.map.getLayersBy("name", view.baseLayer);
					if(matching_layers.length > 0)
						map.map.setBaseLayer(matching_layers[0]);

					for(var i=0; i<map.map.layers.length; i++) {
						if(!map.map.layers[i].isBaseLayer && map.map.layers[i].displayInLayerSwitcher)
							map.map.layers[i].setVisibility(view.layers.indexOf(map.map.layers[i].permalinkName) != -1 || view.layers.indexOf(map.map.layers[i].name) != -1);
					}
				}
			};

			map.addMarker = function(marker) {
				map.deleteMarker(marker);

				var style = {
					externalGraphic: fpUtils.createMarkerGraphic(marker.colour),
					graphicWidth: 21,
					graphicHeight: 25,
					graphicXOffset: -9,
					graphicYOffset: -25
				};
				var feature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(marker.lon, marker.lat).transform(fpUtils.proj(), map.map.getProjectionObject()), null, style);
				feature.fpMarker = marker;
				feature.fpOnClick = function() {
					map.mapEvents.$emit("clickMarker", marker);
				};
				map.layerLines.addFeatures([ feature ]);
				map.markersById[marker.id] = feature;
			};

			map.deleteMarker = function(marker) {
				var markerObj = map.markersById[marker.id];
				if(!markerObj)
					return;

				delete map.markersById[marker.id];
				map.layerLines.removeFeatures([ markerObj ]);
			};

			map.addLine = function(line) {
				map.deleteLine(line);

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

				var feature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString(points).transform(fpUtils.proj(), map.map.getProjectionObject()), null, style);
				feature.fpLine = line;
				feature.fpOnClick = function(clickPos) {
					map.mapEvents.$emit("clickLine", line, clickPos);
				};
				map.layerLines.addFeatures([ feature ]);
				map.linesById[line.id] = feature;
			};

			map.deleteLine = function(line) {
				var lineObj = map.linesById[line.id];
				if(!lineObj)
					return;

				delete map.linesById[line.id];
				map.layerLines.removeFeatures([lineObj]);
			};

			map.addClickListener = function(listener) {
				map.featureHandler.deactivate(); // Disable clicking on markers and lines
				$(map.map.div).addClass("fp-clickHandler");

				var unregister;

				var ret = {
					cancel: function() {
						unregister();
						$(map.map.div).removeClass("fp-clickHandler");
						map.featureHandler.activate();
					}
				};

				setTimeout(function() {
					unregister = map.mapEvents.$on("click", function(e, pos) {
						ret.cancel();
						listener(pos);
					});
				}, 0);

				return ret;
			};

			map.xyToPos = function(xy) {
				return map.map.getLonLatFromViewPortPx(xy).clone().transform(map.map.getProjectionObject(), fpUtils.proj());
			};

			map.posToXy = function(pos) {
				var lonlat = new OpenLayers.LonLat(pos.lon, pos.lat).transform(fpUtils.proj(), map.map.getProjectionObject());
				return map.map.getViewPortPxFromLonLat(lonlat);
			};

			map.getLayerInfo = function() {
				var ret = [ ];
				map.map.layers.forEach(function(it) {
					if(!it.displayInLayerSwitcher)
						return;
					ret.push({ isBaseLayer: it.isBaseLayer, visibility: it.getVisibility(), name: it.name, permalinkName: it.permalinkName });
				});
				return ret;
			};

			map.showLayer = function(permalinkName, show) {
				var layers = map.map.getLayersBy("permalinkName", permalinkName);
				if(layers.length == 0)
					return;

				if(layers[0].isBaseLayer && show)
					map.map.setBaseLayer(layers[0]);
				else
					layers[0].setVisibility(show);
			};

			map.makeLineMovable = function(origLine) {
				map.featureHandler.deactivate();

				var line = $.extend(true, { }, origLine);

				line.actualPoints = line.points;
				map.addLine(line);

				var markers = [ ];
				drawMarkers();

				var drag = new map.DragFeature(map.layerLines, function(feature) {
					return feature.fpMarker && feature.fpMarker.id.match(/^linePoint/);
				}, {
					onDrag : function(feature) {
						line.points[feature.fpMarker.i] = new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y).transform(map.map.getProjectionObject(), fpUtils.proj());
						map.addLine(line);
					}
				});
				map.map.addControl(drag);
				drag.activate();

				return {
					done : function() {
						end();
						return line.points;
					}
				};

				function drawMarkers(end) {
					for(var i=0; i<markers.length; i++)
						map.deleteMarker(markers[i]);
					markers = [ ];

					if(!end) {
						for(var i=0; i<line.points.length; i++) {
							var marker = { id: "linePoint"+i, lat: line.points[i].lat, lon: line.points[i].lon, colour: "ffd700", i: i };
							markers.push(marker);
							map.addMarker(marker);
						}
					}
				}

				function end() {
					drawMarkers(true);
					drag.deactivate();
					map.map.removeControl(drag);
					map.featureHandler.activate();
				}
			};

			map.loadStart = function() {
				map.map.getControlsByClass("FacilMap.Control.Loading")[0].loadStart();
			};

			map.loadEnd = function() {
				map.map.getControlsByClass("FacilMap.Control.Loading")[0].loadEnd();
			};

			map.showLabel = function(label, pos, offset, updateOnMove) {
				var xy = map.posToXy(pos);
				var el = $("<div/>").addClass("fp-map-label").text(label).css({ top: (xy.y+offset.y)+"px", left: (xy.x+offset.x)+"px" }).appendTo(map.map.div);

				var updatePosition = function(e) {
					el.css({ top: (e.y+offset.y)+"px", left: (e.x+offset.x)+"px" });
				};

				if(updateOnMove)
					map.map.events.register("mousemove", null, updatePosition);

				return {
					close: function() {
						el.remove();
						if(updateOnMove)
							map.map.events.unregister("mousemove", null, updatePosition);
					}
				};
			};

			map.messages = fpMapMessages(map);
			map.popups = fpMapPopups(map);
			map.markersUi = fpMapMarkers(map);
			map.linesUi = fpMapLines(map);
			map.viewsUi = fpMapViews(map);
			map.typesUi = fpMapTypes(map);
			map.padUi = fpMapPad(map);

			fpMapToolbox(map);
			fpMapLegend(map);
			fpMapSearch(map);

			map.mapEvents.$on("clickLine", function(e, line, clickPos) {
				map.popups.closeAll();
				map.linesUi.viewLine(line, clickPos);
			});
		}
	} ]);

})(FacilPad, jQuery, angular, FacilMap, OpenLayers);