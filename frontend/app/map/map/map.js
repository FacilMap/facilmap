import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import 'leaflet-almostover';
import 'leaflet.locatecontrol';
import 'leaflet.markercluster';

fm.app.directive("facilmap", function(fmMap) {
	return {
		restrict: 'EA',
		link: function(scope, element, attrs) {
			fmMap.initMap($(element), attrs.id, attrs.fmServerUrl, attrs.fmMapId);
		}
	};
});

fm.app.factory("fmMap", function(fmUtils, fmSocket, fmMapMessages, fmMapMarkers, $compile, fmMapLines, fmMapTypes, fmMapViews, $rootScope, fmMapPad, fmMapToolbox, $timeout, fmMapLegend, fmMapSearch, fmMapAbout, $sce, fmMapImport, fmMapHash, fmMapHistory, $q) {
	var maps = { };

	var ret = { };

	ret.getMap = function(id) {
		return maps[id];
	};

	ret.initMap = function(el, id, serverUrl, padId) {
		return maps[id] = new Map(el, serverUrl, padId);
	};

	return ret;

	function Map(el, serverUrl, padId) {
		var map = this;

		map.el = el;
		map.mapEvents = $rootScope.$new(true); /* Event types: longmousedown, layerchange */
		map.socket = fmSocket(serverUrl, padId);

		let mapnikLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			fmName: "Mapnik",
			fmBase: true,
			fmKey: "Mpnk",
			attribution: $sce.trustAsHtml('© <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
			noWrap: true
		});

		map.layers = { };
		[
			L.tileLayer("http://korona.geog.uni-heidelberg.de/tiles/roads/x={x}&y={y}&z={z}", {
				fmName: "MapSurfer Road",
				fmBase: true,
				fmKey: "MSfR",
				attribution: $sce.trustAsHtml('© <a href="http://korona.geog.uni-heidelberg.de/" target="_blank">OpenMapSurfer</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
				noWrap: true
			}),
			mapnikLayer,
			L.tileLayer("http://beta.map1.eu/tiles/{z}/{x}/{y}.jpg", {
				fmName: "Map1.eu",
				fmBase: true,
				fmKey: "Map1",
				attribution: $sce.trustAsHtml('© <a href="http://map1.eu/" target="_blank">Map1.eu</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
				noWrap: true
			}),
			L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
				fmName: "OpenTopoMap",
				fmBase: true,
				fmKey: "Topo",
				attribution: $sce.trustAsHtml('© <a href="https://opentopomap.org/" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>) / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>')
			}),
			L.tileLayer("https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=bc74ceb5f91c448b9615f9b576c61c16", {
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
			L.tileLayer("https://www.freietonne.de/seekarte/tah.openstreetmap.org/Tiles/TileCache.php?z={z}&x={x}&y={y}.png", {
				fmName: "Mapnik Water",
				fmBase: true,
				fmKey: "MpnW",
				attribution: $sce.trustAsHtml('© <a href="https://www.freietonne.de/" target="_blank">FreieTonne</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
				noWrap: true
			}),
			L.tileLayer("http://openptmap.org/tiles/{z}/{x}/{y}.png", {
				fmName: "Public transportation",
				fmKey: "OPTM",
				attribution: $sce.trustAsHtml('© <a href="http://openptmap.org/" target="_blank">OpenPTMap</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
				zIndex: 300,
				noWrap: true
			}),
			L.tileLayer("http://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png", {
				fmName: "Hiking paths",
				fmKey: "Hike",
				attribution: $sce.trustAsHtml('© <a href="http://osm.lonvia.de/world_hiking.html" target="_blank">Lonvia\'s Hiking Map</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
				zIndex: 300,
				noWrap: true
			}),
			L.tileLayer("http://korona.geog.uni-heidelberg.de/tiles/asterh/x={x}&y={y}&z={z}", {
				fmName: "Relief",
				fmKey: "Rlie",
				attribution: $sce.trustAsHtml('© <a href="http://korona.geog.uni-heidelberg.de/" target="_blank">OpenMapSurfer</a> / <a href="http://www.meti.go.jp/english/press/data/20090626_03.html" target="_blank">METI</a> / <a href="https://lpdaac.usgs.gov/products/aster_policies" target="_blank">NASA</a>'),
				zIndex: 300,
				noWrap: true
			}),
			fmUtils.graticule(map, {
				fmName: "Graticule",
				fmKey: "grid",
				zIndex: 300,
				noWrap: true
			}),
			fmUtils.freieTonne(map, {
				fmName: "Sea marks",
				fmKey: "FrTo",
				attribution: $sce.trustAsHtml('© <a href="https://www.freietonne.de/" target="_blank">FreieTonne</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'),
				zIndex: 300,
				noWrap: true
			})
		].forEach(function(it) {
			map.layers[it.options.fmKey] = it;

			if(it.options.fmBase && it !== mapnikLayer) {
				it.on("tileerror", (err) => {
					mapnikLayer._tileZoom = err.target._tileZoom;
					let fallbackUrl = mapnikLayer.getTileUrl(err.coords);
					if(err.tile.src != fallbackUrl)
						err.tile.src = fallbackUrl;
				});
			}
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

		var tpl = $(require("./map.html"));
		el.append(tpl);
		$compile(tpl)(scope);

		map.map = L.map(el.find(".fm-map")[0]);

		map.socket.$watch("padData.clusterMarkers", (clusterMarkers) => {
			var currentMarkers = map.markerCluster ? map.markerCluster.getLayers() : [ ];

			if(map.markerCluster)
				map.markerCluster.clearLayers().remove();

			if(clusterMarkers) {
				map.markerCluster = L.markerClusterGroup({
					showCoverageOnHover: false,
					maxClusterRadius: 50
				});
			} else
				map.markerCluster = L.featureGroup();

			map.map.addLayer(map.markerCluster);

			for(let marker of currentMarkers)
				map.markerCluster.addLayer(marker);
		});

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
		map.searchMarkerColour = "000000";

		if(L.Browser.touch && !L.Browser.pointer) {
			// Long click will call the contextmenu event
			map.map.on("contextmenu", function(e) {
				map.mapEvents.$emit("longmousedown", e.latlng);
			}.fmWrapApply(map.mapEvents));
		} else {
			fmUtils.onLongMouseDown(map.map, function(e) {
				map.mapEvents.$emit("longmousedown", e.latlng);
			}.fmWrapApply(map.mapEvents));
		}

		map.map.on("layeradd", function() {
			map.mapEvents.$emit("layerchange");
		});

		map.map.on("layerremove", function() {
			map.mapEvents.$emit("layerchange");
		});

		map.getCurrentView = function(addFilter) {
			var ret = fmUtils.leafletToFmBbox(map.map.getBounds());
			ret.layers = [ ];

			map.map.eachLayer(function(it) {
				if(it.options.fmBase)
					ret.baseLayer = it.options.fmKey;
				else if(it.options.fmKey)
					ret.layers.push(it.options.fmKey);
			});

			if(addFilter)
				ret.filter = map.socket.filterExpr;

			return ret;
		};

		map.displayView = function(view, _zoomFactor=0) {
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
				map.map.flyTo(bounds.getCenter(), map.map.getBoundsZoom(bounds, !view)+_zoomFactor);
			} catch(e) {
				map.map.setView(bounds.getCenter(), map.map.getBoundsZoom(bounds, !view)+_zoomFactor);
			}

			map.socket.setFilter(view && view.filter);
		};

		var transparentLayer = new (L.Layer.extend({
			onAdd: function(map) {
				// We append this element to the map container, not to the layers pane, so that it doesn't get moved
				// around and always covers 100% of the map.
				this._el = $('<div class="fm-clickHandler"></div>').appendTo(map.getContainer())[0];
				this.addInteractiveTarget(this._el);
			},
			onRemove: function(map) {
				$(this._el.remove());
				this.removeInteractiveTarget(this._el);
			}
		}))();

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

		map.socket.on("loadStart", function() {
			map.loadStart();
		});

		map.socket.on("loadEnd", function() {
			map.loadEnd();
		});

		map.messages = fmMapMessages(map);
		map.markersUi = fmMapMarkers(map);
		map.linesUi = fmMapLines(map);
		map.viewsUi = fmMapViews(map);
		map.typesUi = fmMapTypes(map);
		map.padUi = fmMapPad(map);
		map.aboutUi = fmMapAbout(map);
		map.importUi = fmMapImport(map);
		map.searchUi = fmMapSearch(map);
		map.hashUi = fmMapHash(map);
		map.historyUi = fmMapHistory(map);

		fmMapToolbox(map);
		fmMapLegend(map);

		$q.resolve().then(() => {
			if(padId) {
				return $q((resolve) => {
					var loadedWatcher = map.socket.$watch("padData", function(padData) {
						if(padData != null) {
							loadedWatcher();

							if(!map.hashUi.hasLocationHash())
								map.displayView(padData.defaultView);
							resolve();
						}
					});
				});
			} else {
				if(!map.hashUi.hasLocationHash()) {
					return $q.resolve($.get({
						url: "https://freegeoip.net/json/",
						dataType: "json"
					})).then((data) => {
						map.map.setView([data.latitude, data.longitude], 6);
						map.displayView(map.getCurrentView()); // To set base layer
					}).catch((err) => {
						console.error("Error contacting GeoIP service", err);
						map.displayView();
					});
				}
			}
		}).then(() => {
			map.hashUi.init();
			scope.loaded = true;
		});

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
