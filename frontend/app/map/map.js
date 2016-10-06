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
					attribution: $sce.trustAsHtml('© <a href="http://korona.geog.uni-heidelberg.de/">OpenMapSurfer</a> / <a href="http://www.openstreetmap.org/copyright">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
					fpName: "Mapnik",
					fpBase: true,
					fpKey: "Mpnk",
					attribution: $sce.trustAsHtml('© <a href="http://www.openstreetmap.org/copyright">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("https://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png", {
					fpName: "OpenCycleMap",
					fpBase: true,
					fpKey: "OCyc",
					attribution: $sce.trustAsHtml('© <a href="https://opencyclemap.org/">OpenCycleMap</a> / <a href="http://www.openstreetmap.org/copyright">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("http://{s}.tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png", {
					fpName: "Hike & Bike Map",
					fpBase: true,
					fpKey: "HiBi",
					attribution: $sce.trustAsHtml('© <a href="http://hikebikemap.org/">Hike &amp; Bike Map</a> / <a href="http://www.openstreetmap.org/copyright">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("http://openptmap.org/tiles/{z}/{x}/{y}.png", {
					fpName: "Public transportation",
					fpKey: "OPTM",
					attribution: $sce.trustAsHtml('© <a href="http://openptmap.org/">OpenPTMap</a> / <a href="http://www.openstreetmap.org/copyright">OSM Contributors</a>'),
					zIndex: 300,
					noWrap: true
				}),
				L.tileLayer("http://korona.geog.uni-heidelberg.de/tiles/asterh/x={x}&y={y}&z={z}", {
					fpName: "Relief",
					fpKey: "Rlie",
					attribution: $sce.trustAsHtml('© <a href="http://korona.geog.uni-heidelberg.de/">OpenMapSurfer</a> / <a href="http://www.meti.go.jp/english/press/data/20090626_03.html">METI</a> / <a href="https://lpdaac.usgs.gov/products/aster_policies">NASA</a>'),
					zIndex: 300,
					noWrap: true
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
			map.featureHandler.activate();*/

			map.dragIcon = fpUtils.createMarkerIcon("ffd700");

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
			}*/

			map.getCurrentView = function() {
				var ret = fpUtils.leafletToFpBbox(map.map.getBounds());
				ret.layers = [ ];

				map.map.eachLayer(function(it) {
					if(it.options.fpBase)
						ret.baseLayer = it.options.fpKey;
					else if(it.options.fpKey)
						ret.layers.push(it.options.fpKey);
				});

				return ret;
			};

			map.displayView = function(view) {
				var layers = [ view && map.layers[view.baseLayer] ? view.baseLayer : Object.keys(map.layers)[0] ].concat(view ? view.layers : [ ]);
				map.map.eachLayer(function(it) {
					if(it.options.fpKey && layers.indexOf(it.options.fpKey) == -1)
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

			map.map.createPane("fpClickListener");
			$(map.map.getPane("fpClickListener")).css("z-index", 620);
			var transparentLayer = L.imageOverlay('data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', [[90,-180],[-90,180]], {
				className: "fp-clickHandler",
				pane: "fpClickListener",
				interactive: true
			});

			map.addClickListener = function(listener, moveListener) {
				transparentLayer.addTo(map.map).on("click", listenClick);

				if(moveListener)
					transparentLayer.on("mousemove", listenMove);

				function listenMove(e) {
					moveListener({ lat: e.latlng.lat, lon: e.latlng.lng });
				}

				function listenClick(e) {
					transparentLayer.removeFrom(map.map).off("click", listenClick);

					if(moveListener)
						transparentLayer.off("mousemove", listenMove);

					if(e) {
						e.originalEvent.preventDefault();
						listener({ lat: e.latlng.lat, lon: e.latlng.lng });
					}
				}

				return {
					cancel: listenClick
				};
			};

			/*map.xyToPos = function(xy) {
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

			/*map.loadStart = function() {
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