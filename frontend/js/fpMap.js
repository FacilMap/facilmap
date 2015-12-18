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
			map.socket = fpSocket(padId);
			map.socket.id = id; // To be in scope for template

			map.markersById = { };
			map.linesById = { };

			var el = $($templateCache.get("map.html"));
			replaceEl.replaceWith(el);
			$compile(el)(map.socket);

			map.map = new FacilMap.Map(el[0], {
				attributionIcon: new ol.Icon("img/logo.png", new ol.Size(191, 176), new ol.Pixel(-37, -131))
			});

			$(map.map.attributionIcon.imageDiv).css({ overflow: "hidden", height: "131px" });

			// Map ID is not set yet as scope is not digested. So styles might change.
			$timeout(map.map.updateSize.bind(map.map));

			map.map.addLayer(new fm.Layer.OSM.MapSurfer.Road(ol.i18n("MapSurfer Road"), { permalinkName : "MSfR" }));
			map.map.addLayer(new fm.Layer.OSM.Mapnik(ol.i18n("Mapnik"), { permalinkName : "Mpnk" }));
			map.map.addLayer(new fm.Layer.OSM.CycleMap(ol.i18n("OpenCycleMap"), { permalinkName : "OCyc" }));
			map.map.addLayer(new fm.Layer.OSM.HikeAndBike(ol.i18n("Hike & Bike Map"), { permalinkName : "HiBi" }));
			map.map.addLayer(new fm.Layer.OSM.OpenPTMap(ol.i18n("Public transportation"), { permalinkName : "OPTM", visibility : false }));
			map.map.addLayer(new fm.Layer.other.Relief(ol.i18n("Relief"), { visibility: false, permalinkName : "Rlie" }));

			map.layerLines = new FacilMap.Layer.Vector("Lines", { displayInLayerSwitcher: false, visibility: true });
			map.map.addLayer(map.layerLines);

			var label;
			map.featureHandler = new OpenLayers.Handler.Feature(null, map.layerLines, {
				"over" : function(obj) {
					$(map.map.div).addClass("fp-overFeature");

					if(label)
						label.close();

					if(obj.fpMarker && obj.fpMarker.name)
						label = map.showLabel(obj.fpMarker.name, obj.fpMarker, { x: 10, y: 0 });
					else if(obj.fpLine && obj.fpLine.name) {
						var e = map.featureHandler.evt;
						label = map.showLabel(obj.fpLine.name, map.xyToPos({ x: e.offsetX == null ? e.layerX : e.offsetX, y: e.offsetY == null ? e.layerY : e.offsetY }), { x: 15, y: 0 }, true);
					}
				},
				"out" : function(obj) {
					$(map.map.div).removeClass("fp-overFeature");

					if(label) {
						label.close();
						label = null;
					}
				},
				"click" : function(obj) {
					obj.fpOnClick(map.xyToPos(map.featureHandler.up), map.featureHandler.evt);
				}
			}, { map: map.map });
			map.featureHandler.activate();

			var dragIcon = fpUtils.createMarkerIcon("ffd700");
			map.dragControl = new FacilMap.Control.DragLine(map.layerLines, dragIcon);
			map.map.addControl(map.dragControl);

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

				var feature = fm.Util.createIconVector(fm.Util.toMapProjection(new ol.LonLat(marker.lon, marker.lat), map.map), fpUtils.createMarkerIcon(marker.colour));
				feature.fpMarker = marker;
				feature.fpOnClick = function(pos, evt) {
					map.mapEvents.$emit("clickMarker", marker, evt);
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
				feature.fpOnClick = function(clickPos, evt) {
					map.mapEvents.$emit("clickLine", line, clickPos, evt);
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

				if(layers[0].isBaseLayer)
					map.map.setBaseLayer(layers[0]);
				else
					layers[0].setVisibility(show);
			};

			map.makeLineMovable = function(origLine) {
				map.featureHandler.deactivate();

				var line = $.extend(true, { }, origLine);
				line.actualPoints = line.points;
				var markers = [ ];
				for(var i=0; i<line.points.length; i++)
					markers.push(fm.Util.createIconVector(fm.Util.toMapProjection(new ol.LonLat(line.points[i].lon, line.points[i].lat), map.map), dragIcon));
				map.layerLines.addFeatures(markers);
				map.addLine(line);

				var dragExcludeBkp = map.layerLines._excludeFeature;
				map.layerLines._excludeFeature = function(feature) {
					return dragExcludeBkp.apply(this, arguments) || (!feature.fmStartLonLat && feature != map.linesById[line.id] && markers.indexOf(feature) == -1);
				};

				map.dragControl.onDblClick = function(feature) {
					var idx = markers.indexOf(feature);
					if(idx != -1) {
						line.points.splice(idx, 1);
						map.addLine(line);

						markers.splice(idx, 1);
						map.layerLines.removeFeatures([ feature ]);
						feature.destroy();
					}
				};

				map.dragControl.onDrag = function(feature) {
					var idx = markers.indexOf(feature);
					if(idx != -1) { // Existing marker was dragged
						var lonlat = fm.Util.fromMapProjection(new ol.LonLat(feature.geometry.x, feature.geometry.y), map.map);
						line.points[idx] = { lat: lonlat.lat, lon: lonlat.lon };
						map.addLine(line);
					}
					else if(feature.fmStartLonLat) { // New marker
						var index = fm.Util.lonLatIndexOnLine(feature.fmStartLonLat, feature.fmLine.geometry);
						if(index != null) {
							var newIndex = line.points.length;
							var indexes = [ ];
							for(var i=0; i<newIndex; i++) {
								indexes.push(fm.Util.lonLatIndexOnLine(fm.Util.toMapProjection(new OpenLayers.LonLat(line.points[i].lon, line.points[i].lat), map.map), feature.fmLine.geometry));
								if(index < fm.Util.lonLatIndexOnLine(fm.Util.toMapProjection(new OpenLayers.LonLat(line.points[i].lon, line.points[i].lat), map.map), feature.fmLine.geometry))
									newIndex = i;
							}

							var lonlat = fm.Util.fromMapProjection(feature.fmStartLonLat, map.map);
							line.points.splice(newIndex, 0, { lat: lonlat.lat, lon: lonlat.lon });
							markers.splice(newIndex, 0, feature);
							map.addLine(line);
						}
						else
							console.warn("Index = null", feature.fmStartLonLat);
					}
				};

				map.dragControl.onComplete = function(feature) {
					if(feature.fmStartLonLat)
						delete feature.fmStartLonLat;
				};

				map.dragControl.activate();

				return {
					done : function() {
						end();
						return line.points;
					}
				};

				function end() {
					if(markers.indexOf(map.dragControl.feature) != -1)
						map.dragControl._simulateOverFeature(null);

					map.layerLines.removeFeatures(markers);
					for(var i=0; i<markers.length; i++)
						markers[i].destroy();

					map.layerLines._excludeFeature = dragExcludeBkp;
					map.dragControl.deactivate();
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
					el.css({ top: ((e.offsetY == null ? e.layerY : e.offsetY)+offset.y)+"px", left: ((e.offsetX == null ? e.layerX : e.offsetX)+offset.x)+"px" });
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

			map.socket.$on("loadStart", function() {
				map.loadStart();
			});

			map.socket.$on("loadEnd", function() {
				map.loadEnd();
			});

			var loadedWatcher = map.socket.$watch("loaded", function(loaded) {
				if(loaded) {
					setTimeout(function() {
						map.displayView(map.socket.padData.defaultView);
					}, 0);
					loadedWatcher();
				}
			});

			map.socket.on("marker", function(data) {
				map.addMarker(data);
			});

			map.socket.on("deleteMarker", function(data) {
				map.deleteMarker(data);
			});

			map.socket.on("line", function(data) {
				setTimeout(function() { // actualPoints needs to be copied over
					map.addLine(map.socket.lines[data.id]);
				}, 0);
			});

			map.socket.on("deleteLine", function(data) {
				map.deleteLine(data);
			});

			map.socket.on("linePoints", function(data) {
				setTimeout(function() {
					map.addLine(map.socket.lines[data.id]);
				}, 0);
			});

			var errorMessage = null;
			map.socket.$watch("disconnected", function(disconnected) {
				if(disconnected && !errorMessage)
					errorMessage = map.messages.showMessage("error", "The connection to the server was lost.");
				else if(!disconnected && errorMessage) {
					errorMessage.close();
					errorMessage = null;
				}
			});

			map.mapEvents.$on("moveEnd", function(e, bbox) {
				map.socket.updateBbox(bbox);
			});
		}
	} ]);

})(FacilPad, jQuery, angular, FacilMap, OpenLayers);