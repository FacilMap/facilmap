(function(fp, $, ng, fm, ol, undefined) {

	fp.app.directive("fpMap", function(fpMap) {
		return {
			restrict: 'EA',
			link: function(scope, element, attrs) {
				fpMap.initMap(element, attrs.id, attrs.fpPadId);
			}
		};
	});

	fp.app.factory("fpMap", function(fpUtils, fpSocket, fpMapMessages, fpMapMarkers, $templateCache, $compile, fpMapLines, fpMapTypes, fpMapViews, $rootScope, fpMapPad, fpMapToolbox, $timeout, fpMapLegend, fpMapSearch, fpMapGpx, fpMapAbout, $sce, L, fpMapImport) {
		var maps = { };

		var ret = { };
		
		ret.getMap = function(id) {
			return maps[id];
		};

		ret.initMap = function(el, id, padId) {
			return maps[id] = new Map(el, padId);
		};

		return ret;

		function Map(el, padId) {
			var map = this;

			map.el = el;
			map.mapEvents = $rootScope.$new(true); /* Event types: click, layerchange */
			map.socket = fpSocket(padId);

			map.layers = { };
			[
				L.tileLayer("http://korona.geog.uni-heidelberg.de/tiles/roads/x={x}&y={y}&z={z}", {
					fpName: "MapSurfer Road",
					fpBase: true,
					fpKey: "MSfR",
					attribution: $sce.trustAsHtml('© <a href="http://korona.geog.uni-heidelberg.de/" target="_blank">OpenMapSurfer</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
					fpName: "Mapnik",
					fpBase: true,
					fpKey: "Mpnk",
					attribution: $sce.trustAsHtml('© <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("https://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png", {
					fpName: "OpenCycleMap",
					fpBase: true,
					fpKey: "OCyc",
					attribution: $sce.trustAsHtml('© <a href="https://opencyclemap.org/" target="_blank">OpenCycleMap</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("http://{s}.tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png", {
					fpName: "Hike & Bike Map",
					fpBase: true,
					fpKey: "HiBi",
					attribution: $sce.trustAsHtml('© <a href="http://hikebikemap.org/" target="_blank">Hike &amp; Bike Map</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("http://openptmap.org/tiles/{z}/{x}/{y}.png", {
					fpName: "Public transportation",
					fpKey: "OPTM",
					attribution: $sce.trustAsHtml('© <a href="http://openptmap.org/" target="_blank">OpenPTMap</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
					zIndex: 300,
					noWrap: true
				}),
				L.tileLayer("http://korona.geog.uni-heidelberg.de/tiles/asterh/x={x}&y={y}&z={z}", {
					fpName: "Relief",
					fpKey: "Rlie",
					attribution: $sce.trustAsHtml('© <a href="http://korona.geog.uni-heidelberg.de/" target="_blank">OpenMapSurfer</a> / <a href="http://www.meti.go.jp/english/press/data/20090626_03.html" target="_blank">METI</a> / <a href="https://lpdaac.usgs.gov/products/aster_policies" target="_blank">NASA</a>'),
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

			map.tooltipOptions = {
				direction: "right"
			};

			var scope = map.socket.$new();
			scope.loaded = false;

			var tpl = $($templateCache.get("map/map/map.html"));
			el.append(tpl);
			$compile(tpl)(scope);

			map.map = L.map(el.find(".fp-map")[0]);

			map.map.almostOver.options.distance = 10;

			L.control.locate({
				flyTo: true,
				icon: "glyphicon glyphicon-screenshot",
				iconLoading: "glyphicon glyphicon-screenshot"
			}).addTo(map.map);

			L.hash(map.map, map.layers);

			map.map.on('almost:over', function(e) {
				e.layer.fire('fp-almostover', e);
				$(map.map.getContainer()).addClass("fp-almostover");
			});

			map.map.on('almost:out', function(e) {
				e.layer.fire('fp-almostout', e);
				$(map.map.getContainer()).removeClass("fp-almostover");
			});

			map.map.on('almost:click', function(e) {
				e.layer.fire('click', e, true);
			});

			map.map.on('almost:move', function(e) {
				e.layer.fire('fp-almostmove', e);
			});

			map.startMarkerColour = "00ff00";
			map.dragMarkerColour = "ffd700";
			map.endMarkerColour = "ff0000";

			map.map.on("click", function(e) {
				map.mapEvents.$emit("click", e.latlng);
			});

			map.map.on("layeradd", function() {
				map.mapEvents.$emit("layerchange");
			});

			map.map.on("layerremove", function() {
				map.mapEvents.$emit("layerchange");
			});

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

			map.socket.loading = 0;

			map.loadStart = function() {
				map.socket.loading++;
			};

			map.loadEnd = function() {
				map.socket.loading--;
			};

			map.socket.$on("loadStart", function() {
				map.loadStart();
			});

			map.socket.$on("loadEnd", function() {
				map.loadEnd();
			});

			map.messages = fpMapMessages(map);
			map.markersUi = fpMapMarkers(map);
			map.linesUi = fpMapLines(map);
			map.viewsUi = fpMapViews(map);
			map.typesUi = fpMapTypes(map);
			map.padUi = fpMapPad(map);
			map.gpxUi = fpMapGpx(map);
			map.toolboxUi = fpMapToolbox(map);
			map.aboutUi = fpMapAbout(map);
			map.importUi = fpMapImport(map);
			map.searchUi = fpMapSearch(map);

			fpMapLegend(map);

			if(padId) {
				var loadedWatcher = map.socket.$watch("padData", function(padData) {
					if(padData != null) {
						loadedWatcher();

						if(!map.map._loaded) // hash control might have set a location already
							map.displayView(padData.defaultView);

						scope.loaded = true;
					}
				});
			} else {
				map.displayView();
				scope.loaded = true;
			}

			var errorMessage = null;
			map.socket.$watch("disconnected", function(disconnected) {
				if(disconnected && !errorMessage && !map.socket.serverError)
					errorMessage = map.messages.showMessage("danger", "The connection to the server was lost.");
				else if(!disconnected && errorMessage) {
					errorMessage.close();
					errorMessage = null;
				}
			});

			map.socket.$watch("serverError", function(serverError) {
				if(serverError) {
					errorMessage && errorMessage.close();
					map.messages.showMessage("danger", serverError);
				}
			});

			map.map.on("moveend", function() {
				if(map.socket.padId)
					map.socket.updateBbox(fpUtils.leafletToFpBbox(map.map.getBounds(), map.map.getZoom()));
			});
		}
	});

})(FacilPad, jQuery, angular, null, null);