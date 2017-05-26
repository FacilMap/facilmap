import fm from '../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import '../../assets/font/fontello.css';
import 'jquery-ui';
import 'jquery-ui/ui/widgets/resizable';

fm.app.factory("fmSearchQuery", function($rootScope, $compile, fmUtils, $timeout, $q, fmSearchRoute, fmSearchFiles, fmSearchImport) {
	return function(map) {
		var iconSuffix = ".n.32.png";

		var scope = $rootScope.$new(true);
		scope.searchString = "";
		scope.submittedSearchString = "";
		scope.searchResults = null;
		scope.showAll = false;
		scope.activeResult = null;
		scope.client = map.client;

		let currentInfoBox = null;

		scope.$watch("activeResult", () => {
			setTimeout(() => {
				let activeResultEl = el.find(".fm-search-results .active");
				if(activeResultEl.length > 0)
					fmUtils.scrollIntoView(activeResultEl, el.find(".fm-search-results"));
			}, 0);
		});

		scope.search = function(noZoom) {
			scope.reset();

			if(scope.searchString.trim() != "") {
				if(scope.searchString.match(/ to /i)) {
					scope.showRoutingForm();
					return routeUi.submit(noZoom);
				}

				var lonlat = fmUtils.decodeLonLatUrl(scope.searchString);
				if(lonlat)
					return map.map.flyTo([ lonlat.lat, lonlat.lon ], lonlat.zoom);

				var q = scope.submittedSearchString = scope.searchString;
				map.mapEvents.$broadcast("searchchange");

				map.client.find({ query: scope.searchString, loadUrls: true, elevation: true }).then(function(results) {
					if(q != scope.submittedSearchString)
						return; // Another search has been started in the meantime

					if(fmUtils.isSearchId(q) && results.length > 0 && results[0].display_name)
						scope.searchString = q = results[0].display_name;

					if(typeof results == "string") {
						scope.showAll = true;
						loadSearchResults(filesUi.parseFiles([ results ]), noZoom);
					} else
						loadSearchResults({features: results}, noZoom);
				}).catch(function(err) {
					map.messages.showMessage("danger", err);
				});
			} else
				map.mapEvents.$broadcast("searchchange");
		};

		scope.showResult = function(result, noZoom) {
			renderResult(scope.submittedSearchString, scope.searchResults.features, result, true, layerGroup, function() { scope.activeResult = result; }, null, true);

			if(noZoom == 2) {
				if(result.boundingbox)
					_flyToBounds(map.map.getBounds().extend(L.latLngBounds([ [ result.boundingbox[0], result.boundingbox[3 ] ], [ result.boundingbox[1], result.boundingbox[2] ] ])));
				else if(result.layer)
					_flyToBounds(map.map.getBounds().extend(result.layer.getBounds()));
				else if(result.lat != null && result.lon != null)
					_flyToBounds(map.map.getBounds().extend(L.latLng(result.lat, result.lon)));
			} else if(noZoom == 3) {
				scope.zoomToAll();
			} else if(!noZoom) {
				if(result.lat && result.lon && result.zoom)
					map.map.flyTo([ result.lat, result.lon ], result.zoom);
				else if(result.boundingbox)
					_flyToBounds(L.latLngBounds([ [ result.boundingbox[0], result.boundingbox[3 ] ], [ result.boundingbox[1], result.boundingbox[2] ] ]));
				else if(result.layer)
					_flyToBounds(result.layer.getBounds());
			}

			map.mapEvents.$broadcast("searchchange");
		};

		scope.zoomToAll = function() {
			_flyToBounds(layerGroup.getBounds());
		};

		scope.showRoutingForm = function() {
			searchUi.hide();
			routeUi.show();

			if(scope.searchString.match(/ to /i)) {
				var spl = fmUtils.splitRouteQuery(scope.searchString);
				routeUi.setQueries(spl.queries);
				if(spl.mode)
					routeUi.setMode(spl.mode);
			} else if(!routeUi.getTypedQueries()[0]) {
				if(scope.searchResults && scope.submittedSearchString == scope.searchString)
					routeUi.setFrom(scope.searchString, scope.searchResults.features, scope.activeResult);
				else
					routeUi.setFrom(scope.searchString);
			}
		};

		scope.$watch("showAll", () => {
			map.mapEvents.$broadcast("searchchange");
		});

		scope.showView = function(view) {
			map.displayView(view);
		};

		scope.viewExists = function(view) {
			for(let viewId in map.client.views) {
				if(["name", "baseLayer", "layers", "top", "bottom", "left", "right", "filter"].filter((idx) => !ng.equals(view[idx], map.client.views[viewId][idx])).length == 0)
					return true;
			}
			return false;
		};

		scope.addView = function(view) {
			map.client.addView(view);
		};

		scope.typeExists = function(type) {
			for(let typeId in map.client.types) {
				if(["name", "type", "defaultColour", "colourFixed", "defaultSize", "sizeFixed", "defaultSymbol", "symbolFixed", "defaultWidth", "widthFixed", "defaultMode", "modeFixed", "fields"].filter((idx) => !ng.equals(type[idx], map.client.types[typeId][idx])).length == 0)
					return true;
			}
			return false;
		};

		scope.addType = function(type) {
			map.client.addType(type);
		};

		scope.addResultToMap = function(result, type, noEdit) {
			importUi.addResultToMap(result, type, !noEdit);
		};

		scope.addAllToMap = function(type) {
			for(let result of scope.searchResults.features) {
				if((type.type == "marker" && result.isMarker) || (type.type == "line" && result.isLine))
					scope.addResultToMap(result, type, true);
			}
		};

		scope.customImport = function() {
			importUi.openImportDialog(scope.searchResults);
		};

		var el = $(require("./search-query.html")).insertAfter(map.map.getContainer());
		$compile(el)(scope);
		scope.$evalAsync(); // $compile only replaces variables on next digest

		var clickMarker = L.featureGroup([]).addTo(map.map);

		map.mapEvents.$on("longmousedown", function(e, latlng) {
			clickMarker.clearLayers();

			map.client.find({ query: "geo:" + fmUtils.round(latlng.lat, 5) + "," + fmUtils.round(latlng.lng, 5) + "?z=" + map.map.getZoom(), loadUrls: false, elevation: true }).then(function(results) {
				clickMarker.clearLayers();

				if(results.length > 0) {
					prepareResults(results);

					renderResult(fmUtils.round(latlng.lat, 5) + "," + fmUtils.round(latlng.lng, 5), results, results[0], true, clickMarker, null, () => {
						clickMarker.clearLayers();
					}, true);
					currentInfoBox = null; // We don't want it to be cleared when we cleared when we switch to the routing form for example
				}
			}).catch(function(err) {
				map.messages.showMessage("danger", err);
			});
		});

		var layerGroup = L.featureGroup([]).addTo(map.map);

		function _flyToBounds(bounds) {
			let currentCenter = map.map.getBounds().getCenter();
			let newCenter = bounds.getCenter();

			if(currentCenter.lat == newCenter.lat && currentCenter.lng == newCenter.lng) // map.getCenter() is different from map.getBounds().getCenter()
				return;

			map.map.flyTo(newCenter, Math.min(15, map.map.getBoundsZoom(bounds)));
		}

		function prepareResults(results) {
			for(let result of results) {
				if((result.lat != null && result.lon != null) || result.geojson && result.geojson.type == "Point")
					result.isMarker = true;
				if([ "LineString", "MultiLineString", "Polygon" ].indexOf(result.geojson && result.geojson.type) != -1)
					result.isLine = true;
			}
		}

		function loadSearchResults(results, noZoom) {
			if(currentInfoBox) {
				currentInfoBox.hide();
				currentInfoBox = null;
			}
			clearRenders();

			scope.searchResults = results;

			if(results && results.features.length > 0) {
				prepareResults(results.features);

				scope.searchResults.features.forEach(function(result) {
					renderResult(scope.submittedSearchString, scope.searchResults.features, result, false, layerGroup, function() { scope.activeResult = result; });
				});

				scope.showResult(scope.searchResults.features[0], noZoom || (scope.showAll ? 3 : false));
			}
		}

		function renderResult(query, results, result, showPopup, layerGroup, onOpen, onClose, highlight) {
			if(showPopup) { // Do this first, so that any onClose function is called before creating the new result rendering
				showResultInfoBox(query, results, result, () => {
					if((result.marker && result.marker._map) || (result.layer && result.layer._map)) // Only rerender if it's still on the map
						renderResult(query, results, result, false, layerGroup, onOpen, onClose, false);
					onClose && onClose();
				});
				onOpen && onOpen();
			}

			if(result.layer) {
				result.layer.remove();
				result.layer = null;
			}
			if(result.highlightLayer) {
				result.highlightLayer.remove();
				result.highlightLayer = null;
			}
			if(result.marker) {
				result.marker.remove();
				result.marker = null;
			}

			if(!result.lat || !result.lon || (result.geojson && result.geojson.type != "Point")) { // If the geojson is just a point, we already render our own marker
				result.layer = L.geoJson(result.geojson, {
					pane: highlight ? "fmHighlightPane" : "overlayPane",
					pointToLayer: function(geoJsonPoint, latlng) {
					    return L.marker(latlng, {
					        icon: fmUtils.createMarkerIcon("ff0000", 35, null, null, highlight),
						    pane: highlight ? "fmHighlightMarkerPane" : "markerPane"
					    });
					}
				})
				.on("click", function(e) {
					renderResult(query, results, result, true, layerGroup, onOpen, onClose, true);
					onOpen && onOpen();
				}.fmWrapApply($rootScope))
				.bindTooltip(result.display_name, $.extend({}, map.tooltipOptions, { sticky: true, offset: [ 20, 0 ] }));

				layerGroup.addLayer(result.layer);

				if(highlight) {
					result.highlightLayer = L.geoJson(result.geojson, {
						pane: "fmHighlightShadowPane",
						pointToLayer: function(geoJsonPoint, latlng) {
						    return L.marker(latlng, {
						        icon: fmUtils.createMarkerIcon("ff0000", 35, null, null, highlight),
						        pane: highlight ? "fmHighlightMarkerPane" : "markerPane"
						    });
						},
						color: '#000000'
					})
					.on("click", function(e) {
						renderResult(query, results, result, true, layerGroup, onOpen, onClose, true);
						onOpen && onOpen();
					}.fmWrapApply($rootScope));

					fmUtils.blurFilter(result.highlightLayer, "fmSearchBlur", 4);

					layerGroup.addLayer(result.highlightLayer);
				}
			}

			if(result.lat != null && result.lon != null) {
				result.marker = L.marker([ result.lat, result.lon ], {
					pane: highlight ? "fmHighlightMarkerPane" : "markerPane",
					icon: fmUtils.createMarkerIcon(map.searchMarkerColour, 35, result.icon, null, highlight)
				})
					.on("click", function(e) {
						renderResult(query, results, result, true, layerGroup, onOpen, onClose, true);
						onOpen && onOpen();
					}.fmWrapApply(scope))
					.bindTooltip(result.display_name, $.extend({}, map.tooltipOptions, { offset: [ 20, 0 ] }));

				layerGroup.addLayer(result.marker);
			}
		}

		scope.reset = function() {
			if(currentInfoBox) {
				currentInfoBox.hide();
				currentInfoBox = null;
			}

			scope.searchResults = null;
			scope.activeResult = null;
			scope.submittedSearchString = "";
			clearRenders();
		};

		function clearRenders() {
			layerGroup.clearLayers();
			if(scope.searchResults) {
				scope.searchResults.features.forEach((result) => {
					result.marker = null;
					result.layer = null;
				});
			}
		}

		function showResultInfoBox(query, results, result, onClose) {
			var popupScope = $rootScope.$new();

			popupScope.client = map.client;
			popupScope.result = result;

			popupScope.addToMap = function(type) {
				scope.addResultToMap(result, type);
			};

			popupScope.useForRoute = function(mode) {
				searchUi.setRouteDestination(query, mode, results, result);
			};

			currentInfoBox = map.infoBox.show(require("./result-popup.html"), popupScope, () => {
				popupScope.$destroy();

				onClose && onClose();
				currentInfoBox = null;
			});
		}

		var searchUi = {
			_el: el.filter(".fm-search"),

			show: function() {
				searchUi._el.show();
				map.mapEvents.$broadcast("searchchange");
			},

			hide: function() {
				scope.reset();
				searchUi._el.hide();
				map.mapEvents.$broadcast("searchchange");
			},

			search: function(query, noZoom, showAll) {
				if(!searchUi._el.is(":visible")) {
					routeUi.hide();
					searchUi.show();
				}

				if(query != null)
					scope.searchString = query;

				if(showAll != null)
					scope.showAll = showAll;

				scope.search(noZoom);
			},

			showFiles: function(files) {
				if(!searchUi._el.is(":visible")) {
					routeUi.hide();
					searchUi.show();
				}

				scope.submittedSearchString = "";
				scope.showAll = true;
				loadSearchResults(filesUi.parseFiles(files));
			},

			route: function(destinations, mode, noZoom, noSubmit) {
				searchUi.hide();
				routeUi.show();

				routeUi.setQueries(destinations);
				if(mode)
					routeUi.setMode(mode);

				if(!noSubmit)
					routeUi.submit(noZoom);
			},

			setRouteDestination: function(query, mode, _results, _result) {
				map.searchUi.hide();
				routeUi.show();

				if(mode == 1)
					routeUi.setFrom(query, _results, _result);
				else if(mode == 2)
					routeUi.addVia(query, _results, _result);
				else if(mode == 3)
					routeUi.setTo(query, _results, _result);

				routeUi.submit(!!routeUi.getQueries());
			},

			getCurrentSearchForHash: function() {
				if(searchUi._el.is(":visible")) {
					if(((scope.searchResults && scope.searchResults.features.length == 1) || !scope.showAll) && scope.activeResult && scope.activeResult.id)
						return scope.activeResult.id;
					else if(scope.submittedSearchString)
						return scope.submittedSearchString;
				} else {
					var queries = routeUi.getQueries();
					if(queries)
						return queries.join(" to ") + " by " + routeUi.getMode();
				}
			},

			destroy: function() {
				scope.reset();
				searchUi._el.remove();
				scope.$destroy();
				routeUi.destroy();
			}
		};

		var routeUi = fmSearchRoute(map, searchUi);
		var filesUi = fmSearchFiles(map, searchUi);
		var importUi = fmSearchImport(map);

		el.find(".fm-search-results").resizable({
			handles: {
				se: el.find(".fm-search-resize")
			},
			minHeight: 0
		}).one("resize", () => {
			el.filter(".fm-search").addClass("fm-search-resized");
		}).on("resize", () => {
			el.find("form").css("width", `${el.find(".fm-search-results").innerWidth()}px`);
		});

		return searchUi;
	};
});
