(function(fm, $, ng, undefined) {

	fm.app.directive("facilmap", function(fmMap) {
		return {
			restrict: 'EA',
			link: function(scope, element, attrs) {
				fmMap.initMap(element, attrs.id, attrs.fmMapId);
			}
		};
	});

	fm.app.factory("fmMap", function(fmUtils, fmSocket, fmMapMessages, fmMapMarkers, $templateCache, $compile, fmMapLines, fmMapTypes, fmMapViews, $rootScope, fmMapPad, fmMapToolbox, $timeout, fmMapLegend, fmMapSearch, fmMapGpx, fmMapAbout, $sce, L, fmMapImport, fmMapHash) {
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
			map.mapEvents = $rootScope.$new(true); /* Event types: longclick, layerchange */
			map.socket = fmSocket(padId);

			map.layers = { };
			[
				L.tileLayer("http://korona.geog.uni-heidelberg.de/tiles/roads/x={x}&y={y}&z={z}", {
					fmName: "MapSurfer Road",
					fmBase: true,
					fmKey: "MSfR",
					attribution: $sce.trustAsHtml('© <a href="http://korona.geog.uni-heidelberg.de/" target="_blank">OpenMapSurfer</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
					fmName: "Mapnik",
					fmBase: true,
					fmKey: "Mpnk",
					attribution: $sce.trustAsHtml('© <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("https://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png", {
					fmName: "OpenCycleMap",
					fmBase: true,
					fmKey: "OCyc",
					attribution: $sce.trustAsHtml('© <a href="https://opencyclemap.org/" target="_blank">OpenCycleMap</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("http://{s}.tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png", {
					fmName: "Hike & Bike Map",
					fmBase: true,
					fmKey: "HiBi",
					attribution: $sce.trustAsHtml('© <a href="http://hikebikemap.org/" target="_blank">Hike &amp; Bike Map</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
					noWrap: true
				}),
				L.tileLayer("http://openptmap.org/tiles/{z}/{x}/{y}.png", {
					fmName: "Public transportation",
					fmKey: "OPTM",
					attribution: $sce.trustAsHtml('© <a href="http://openptmap.org/" target="_blank">OpenPTMap</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
					zIndex: 300,
					noWrap: true
				}),
				L.tileLayer("http://korona.geog.uni-heidelberg.de/tiles/asterh/x={x}&y={y}&z={z}", {
					fmName: "Relief",
					fmKey: "Rlie",
					attribution: $sce.trustAsHtml('© <a href="http://korona.geog.uni-heidelberg.de/" target="_blank">OpenMapSurfer</a> / <a href="http://www.meti.go.jp/english/press/data/20090626_03.html" target="_blank">METI</a> / <a href="https://lpdaac.usgs.gov/products/aster_policies" target="_blank">NASA</a>'),
					zIndex: 300,
					noWrap: true
				})
			].forEach(function(it) {
				map.layers[it.options.fmKey] = it;
			});

			map.popupOptions = {
				minWidth: 350,
				maxWidth: 350,
				className: "fm-popup"
			};

			map.tooltipOptions = {
				direction: "right"
			};

			var scope = map.socket.$new();
			scope.loaded = false;

			var tpl = $($templateCache.get("map/map/map.html"));
			el.append(tpl);
			$compile(tpl)(scope);

			map.map = L.map(el.find(".fm-map")[0]);

			map.map.almostOver.options.distance = 10;

			L.control.locate({
				flyTo: true,
				icon: "glyphicon glyphicon-screenshot",
				iconLoading: "glyphicon glyphicon-screenshot"
			}).addTo(map.map);

			map.map.on('almost:over', function(e) {
				e.layer.fire('fm-almostover', e);
				$(map.map.getContainer()).addClass("fm-almostover");
			});

			map.map.on('almost:out', function(e) {
				e.layer.fire('fm-almostout', e);
				$(map.map.getContainer()).removeClass("fm-almostover");
			});

			map.map.on('almost:click', function(e) {
				e.layer.fire('click', e, true);
			});

			map.map.on('almost:move', function(e) {
				e.layer.fire('fm-almostmove', e);
			});

			map.startMarkerColour = "00ff00";
			map.dragMarkerColour = "ffd700";
			map.endMarkerColour = "ff0000";

			if(L.Browser.touch && !L.Browser.pointer) {
				// Long click will call the contextmenu event
				map.map.on("contextmenu", function(e) {
					map.mapEvents.$emit("longclick", e.latlng);
				}.fmWrapApply(map.mapEvents));
			} else {
				fmUtils.onLongClick(map.map, function(e) {
					map.mapEvents.$emit("longclick", e.latlng);
				}.fmWrapApply(map.mapEvents));
			}

			map.map.on("layeradd", function() {
				map.mapEvents.$emit("layerchange");
			});

			map.map.on("layerremove", function() {
				map.mapEvents.$emit("layerchange");
			});

			map.getCurrentView = function() {
				var ret = fmUtils.leafletToFmBbox(map.map.getBounds());
				ret.layers = [ ];

				map.map.eachLayer(function(it) {
					if(it.options.fmBase)
						ret.baseLayer = it.options.fmKey;
					else if(it.options.fmKey)
						ret.layers.push(it.options.fmKey);
				});

				return ret;
			};

			map.displayView = function(view) {
				var layers = [ view && map.layers[view.baseLayer] ? view.baseLayer : Object.keys(map.layers)[0] ].concat(view ? view.layers : [ ]);
				map.map.eachLayer(function(it) {
					if(it.options.fmKey && layers.indexOf(it.options.fmKey) == -1)
						map.map.removeLayer(it);
				});
				layers.forEach(function(it) {
					if(!map.layers[it])
						return;

					if(!map.map.hasLayer(map.layers[it]))
						map.map.addLayer(map.layers[it]);
				});

				var bounds = fmUtils.fmToLeafletBbox(view || { top: -90, bottom: 90, left: -180, right: 180 });

				try {
					map.map.getCenter(); // Throws exception if map not initialised
					map.map.flyTo(bounds.getCenter(), map.map.getBoundsZoom(bounds, !view));
				} catch(e) {
					map.map.setView(bounds.getCenter(), map.map.getBoundsZoom(bounds, !view));
				}
			};

			map.map.createPane("fmClickListener");
			$(map.map.getPane("fmClickListener")).css("z-index", 620);
			var transparentLayer = L.imageOverlay('data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', [[90,-180],[-90,180]], {
				className: "fm-clickHandler",
				pane: "fmClickListener",
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
					(it.options.fmBase ? ret.base : ret.overlay).push({ visibility: map.map.hasLayer(it), name: it.options.fmName, permalinkName: it.options.fmKey, attribution: it.options.attribution });
				}
				return ret;
			};

			map.showLayer = function(key, show) {
				if(!map.layers[key])
					return;

				if(!map.layers[key].options.fmBase) {
					if(!map.map.hasLayer(map.layers[key]) != !show)
						show ? map.map.addLayer(map.layers[key]) : map.map.removeLayer(map.layers[key]);
				} else if(!map.map.hasLayer(map.layers[key])) {
					map.map.eachLayer(function(it) {
						if(it.options.fmBase)
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

			map.messages = fmMapMessages(map);
			map.markersUi = fmMapMarkers(map);
			map.linesUi = fmMapLines(map);
			map.viewsUi = fmMapViews(map);
			map.typesUi = fmMapTypes(map);
			map.padUi = fmMapPad(map);
			map.gpxUi = fmMapGpx(map);
			map.toolboxUi = fmMapToolbox(map);
			map.aboutUi = fmMapAbout(map);
			map.importUi = fmMapImport(map);
			map.searchUi = fmMapSearch(map);

			fmMapLegend(map);
			fmMapHash(map);

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
				if(!map.map._loaded) // hash control might have set a location already
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
					map.socket.updateBbox(fmUtils.leafletToFmBbox(map.map.getBounds(), map.map.getZoom()));
			});
		}
	});

})(FacilMap, jQuery, angular, null);