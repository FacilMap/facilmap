(function(fp, $, ng, fm, ol, undefined) {

	fp.app.directive("fpMap", function(fpMap) {
		return {
			restrict: 'EA',
			link: function(scope, element, attrs) {
				fpMap.initMap(element, attrs.id, attrs.fpPadId);
			}
		};
	});

	fp.app.factory("fpMap", function(fpUtils, fpSocket, fpMapMessages, fpMapMarkers, $templateCache, $compile, fpMapLines, fpMapTypes, fpMapViews, $rootScope, fpMapPad, fpMapToolbox, $timeout, fpMapLegend, fpMapSearch, fpMapGpx, fpMapAbout, $sce, L) {
		var maps = { };

		var ret = { };
		
		ret.getMap = function(id) {
			return maps[id];
		};

		ret.initMap = function(el, id, padId) {
			return maps[id] = new Map(el, id, padId);
		};

		return ret;

		function Map(el, id, padId) {
			var map = this;

			map.mapEvents = $rootScope.$new(true); /* Event types: clickMarker, clickLine, click, move, moveEnd, mouseMove, layerchange */
			map.socket = fpSocket(padId);

			//map.socket.id = id; // To be in scope for template

			map.markersById = { };
			map.linesById = { };

			map.layers = { };
			[
				L.gridLayer({
					fpName: "Empty",
					fpBase: true,
					fpKey: "empt"
				}),
				L.tileLayer("http://korona.geog.uni-heidelberg.de/tiles/roads/x={x}&y={y}&z={z}", {
					fpName: "MapSurfer Road",
					fpBase: true,
					fpKey: "MSfR",
					attribution: $sce.trustAsHtml('© <a href="http://korona.geog.uni-heidelberg.de/">OpenMapSurfer</a> / <a href="http://www.openstreetmap.org/copyright">OSM Contributors</a>')
				}),
				L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
					fpName: "Mapnik",
					fpBase: true,
					fpKey: "Mpnk",
					attribution: $sce.trustAsHtml('© <a href="http://www.openstreetmap.org/copyright">OSM Contributors</a>')
				}),
				L.tileLayer("https://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png", {
					fpName: "OpenCycleMap",
					fpBase: true,
					fpKey: "OCyc",
					attribution: $sce.trustAsHtml('© <a href="https://opencyclemap.org/">OpenCycleMap</a> / <a href="http://www.openstreetmap.org/copyright">OSM Contributors</a>')
				}),
				L.tileLayer("http://{s}.tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png", {
					fpName: "Hike & Bike Map",
					fpBase: true,
					fpKey: "HiBi",
					attribution: $sce.trustAsHtml('© <a href="http://hikebikemap.org/">Hike &amp; Bike Map</a> / <a href="http://www.openstreetmap.org/copyright">OSM Contributors</a>')
				}),
				L.tileLayer("http://openptmap.org/tiles/{z}/{x}/{y}.png", {
					fpName: "Public transportation",
					fpKey: "OPTM",
					attribution: $sce.trustAsHtml('© <a href="http://openptmap.org/">OpenPTMap</a> / <a href="http://www.openstreetmap.org/copyright">OSM Contributors</a>'),
					zIndex: 300
				}),
				L.tileLayer("http://korona.geog.uni-heidelberg.de/tiles/asterh/x={x}&y={y}&z={z}", {
					fpName: "Relief",
					fpKey: "Rlie",
					attribution: $sce.trustAsHtml('© <a href="http://korona.geog.uni-heidelberg.de/">OpenMapSurfer</a> / <a href="http://www.meti.go.jp/english/press/data/20090626_03.html">METI</a> / <a href="https://lpdaac.usgs.gov/products/aster_policies">NASA</a>'),
					zIndex: 300
				})
			].forEach(function(it) {
				map.layers[it.options.fpKey] = it;
			});

			map.popupOptions = {
				minWidth: 350,
				maxWidth: 350,
				className: "fp-popup"
			};

			map.map = L.map(el[0]);

			var tpl = $($templateCache.get("map/map.html"));
			el.append(tpl);
			$compile(tpl)(map.socket);

			map.map.almostOver.options.distance = 10;

			map.map.on('almost:over', function() {
				$(map.map.getContainer()).addClass("fp-almostover");
			});

			map.map.on('almost:out', function() {
				$(map.map.getContainer()).removeClass("fp-almostover");
			});

			map.map.on('almost:click', function(e) {
				e.layer.fire('click', e, true);
			});

			// Map ID is not set yet as scope is not digested. So styles might change.
			//$timeout(map.map.updateSize.bind(pad.map));

			/*var label;
			map.featureHandler = new ol.Handler.Feature(null, map.layerLines, {
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
			map.dragControl = new fm.Control.DragLine(map.layerLines, dragIcon);
			map.map.addControl(map.dragControl);*/

			map.map.on("click", function(e) {
				map.mapEvents.$emit("click", e.latlng);
			});

			map.map.on("layeradd", function() {
				map.mapEvents.$emit("layerchange");
			});

			map.map.on("layerremove", function() {
				map.mapEvents.$emit("layerchange");
			});

			/*map.map.events.register("move", this, function() {
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
			};*/

			map.displayView = function(view) {
				var layers = [ view && map.layers[view.baseLayer] ? view.baseLayer : Object.keys(map.layers)[0] ].concat(view ? view.layers : [ ]);
				map.map.eachLayer(function(it) {
					if(layers.indexOf(it.fpKey) == -1)
						map.map.removeLayer(it);
				});
				layers.forEach(function(it) {
					if(!map.layers[it])
						return;

					if(!map.map.hasLayer(map.layers[it]))
						map.map.addLayer(map.layers[it]);
				});

				var bounds = fpUtils.fpToLeafletBbox(view || { top: -90, bottom: 90, left: -180, right: -180 });

				try {
					map.map.getCenter(); // Throws exception if map not initialised
					map.map.flyToBounds(bounds);
				} catch(e) {
					map.map.fitBounds(bounds);
				}
			};

			map.addMarker = function(marker) {
				map.deleteMarker(marker);

				map.markersById[marker.id] = L.marker([ marker.lat, marker.lon ], {
					icon: fpUtils.createMarkerIcon(marker.colour)
				})
					.addTo(map.map)
					.bindPopup($("<div/>")[0], map.popupOptions)
					.on("popupopen", function(e) {
						map.markersUi.renderMarkerPopup(marker, $(e.popup.getContent()), function() {
							e.popup.update();
						});
					})
					.on("popupclose", function(e) {
						ng.element(e.popup.getContent()).scope().$destroy();
					});
			};

			map.deleteMarker = function(marker) {
				if(!map.markersById[marker.id])
					return;

				map.markersById[marker.id].removeFrom(map.map);
				delete map.markersById[marker.id];
			};

			map.addLine = function(line) {
				map.deleteLine(line);

				if(!line.trackPoints || line.trackPoints.length < 2)
					return;

				var trackPoints = [ ];
				for(var i=0; i<line.trackPoints.length; i++) {
					if(line.trackPoints[i] != null)
						trackPoints.push([ line.trackPoints[i].lat, line.trackPoints[i].lon ]);
				}

				if(trackPoints.length < 2)
					return;

				var style = {
					color : '#'+line.colour,
					weight : line.width,
					opacity : 0.7
				};

				map.linesById[line.id] = L.polyline(trackPoints, style)
					.addTo(map.map)
					.bindPopup($("<div/>")[0], map.popupOptions)
					.on("popupopen", function(e) {
						map.linesUi.renderLinePopup(line, $(e.popup.getContent()), function() {
							e.popup.update();
						});
					})
					.on("popupclose", function(e) {
						ng.element(e.popup.getContent()).scope().$destroy();
					});

				map.map.almostOver.addLayer(map.linesById[line.id]);
			};

			map.deleteLine = function(line) {
				var lineObj = map.linesById[line.id];
				if(!lineObj)
					return;

				map.map.almostOver.removeLayer(lineObj);
				lineObj.removeFrom(map.map);
				delete map.linesById[line.id];
			};

			/*map.addClickListener = function(listener) {
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
				var lonlat = new ol.LonLat(pos.lon, pos.lat).transform(fpUtils.proj(), map.map.getProjectionObject());
				return map.map.getViewPortPxFromLonLat(lonlat);
			};*/

			map.getLayerInfo = function() {
				var ret = { base: [ ], overlay: [ ] };
				for(var i in map.layers) {
					var it = map.layers[i];
					(it.options.fpBase ? ret.base : ret.overlay).push({ visibility: map.map.hasLayer(it), name: it.options.fpName, permalinkName: it.options.fpKey, attribution: it.options.attribution });
				}
				return ret;
			};

			map.showLayer = function(key, show) {
				if(!map.layers[key])
					return;

				if(!map.layers[key].options.fpBase) {
					if(!map.map.hasLayer(map.layers[key]) != !show)
						show ? map.map.addLayer(map.layers[key]) : map.map.removeLayer(map.layers[key]);
				} else if(!map.map.hasLayer(map.layers[key])) {
					map.map.eachLayer(function(it) {
						if(it.options.fpBase)
							map.map.removeLayer(it);
					});

					map.map.addLayer(map.layers[key]);
				}
			};

			/*map.makeLineMovable = function(origLine) {
				map.featureHandler.deactivate();

				var line = $.extend(true, { }, origLine);
				line.trackPoints = line.routePoints;
				var markers = [ ];
				for(var i=0; i<line.routePoints.length; i++)
					markers.push(fm.Util.createIconVector(fm.Util.toMapProjection(new ol.LonLat(line.routePoints[i].lon, line.routePoints[i].lat), map.map), dragIcon));
				map.layerLines.addFeatures(markers);
				map.addLine(line);

				var dragExcludeBkp = map.layerLines._excludeFeature;
				map.layerLines._excludeFeature = function(feature) {
					return dragExcludeBkp.apply(this, arguments) || (!feature.fmStartLonLat && feature != map.linesById[line.id] && markers.indexOf(feature) == -1);
				};

				map.dragControl.onDblClick = function(feature) {
					var idx = markers.indexOf(feature);
					if(idx != -1) {
						line.routePoints.splice(idx, 1);
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
						line.routePoints[idx] = { lat: lonlat.lat, lon: lonlat.lon };
						map.addLine(line);
					}
					else if(feature.fmStartLonLat) { // New marker
						var index = fm.Util.lonLatIndexOnLine(feature.fmStartLonLat, feature.fmLine.geometry);
						if(index != null) {
							var newIndex = line.routePoints.length;
							var indexes = [ ];
							for(var i=0; i<newIndex; i++) {
								indexes.push(fm.Util.lonLatIndexOnLine(fm.Util.toMapProjection(new ol.LonLat(line.routePoints[i].lon, line.routePoints[i].lat), map.map), feature.fmLine.geometry));
								if(index < fm.Util.lonLatIndexOnLine(fm.Util.toMapProjection(new ol.LonLat(line.routePoints[i].lon, line.routePoints[i].lat), map.map), feature.fmLine.geometry))
									newIndex = i;
							}

							var lonlat = fm.Util.fromMapProjection(feature.fmStartLonLat, map.map);
							line.routePoints.splice(newIndex, 0, { lat: lonlat.lat, lon: lonlat.lon });
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
						return line.routePoints;
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
			};*/

			map.myLocation = function() {
				map.map.locate({setView: true, maxZoom: 16});
			};

			map.messages = fpMapMessages(map);
			map.markersUi = fpMapMarkers(map);
			map.linesUi = fpMapLines(map);
			map.viewsUi = fpMapViews(map);
			map.typesUi = fpMapTypes(map);
			map.padUi = fpMapPad(map);
			map.gpxUi = fpMapGpx(map);
			map.toolboxUi = fpMapToolbox(map);
			map.aboutUi = fpMapAbout(map);

			fpMapLegend(map);
			//fpMapSearch(map);

			/*map.socket.$on("loadStart", function() {
				map.loadStart();
			});

			map.socket.$on("loadEnd", function() {
				map.loadEnd();
			});*/

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
				setTimeout(function() { // trackPoints needs to be copied over
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
					errorMessage = map.messages.showMessage("danger", "The connection to the server was lost.");
				else if(!disconnected && errorMessage) {
					errorMessage.close();
					errorMessage = null;
				}
			});

			map.map.on("moveend", function() {
				map.socket.updateBbox(fpUtils.leafletToFpBbox(map.map.getBounds(), map.map.getZoom()));
			});
		}
	});

})(FacilPad, jQuery, angular, null, null);