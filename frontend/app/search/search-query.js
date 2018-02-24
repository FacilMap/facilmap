import fm from '../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import 'jquery-ui';
import 'jquery-ui/ui/widgets/resizable';
import css from './search-query.scss';

fm.app.directive("fmSearchQuery", function($rootScope, $compile, fmUtils, $timeout, $q, fmSearchFiles, fmSearchImport) {
	return {
		require: "^fmSearch",
		scope: true,
		replace: true,
		template: require("./search-query.html"),
		link(scope, el, attrs, searchUi) {
			const map = searchUi.map;

			var iconSuffix = ".n.32.png";

			scope.searchString = "";
			scope.submittedSearchString = "";
			scope.searchResults = null;
			scope.showAll = false;
			scope.activeResult = null;
			scope.client = map.client;
			scope.className = css.className;

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
						return searchUi.routeUi.submit(noZoom);
					}

					var lonlat = fmUtils.decodeLonLatUrl(scope.searchString);
					if(lonlat)
						return _flyTo([ lonlat.lat, lonlat.lon ], lonlat.zoom);

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

				if(!noZoom || noZoom == 2 || noZoom == 3)
					_flyTo(...getZoomDestination(noZoom == 3 ? null : result, noZoom == 2));

				map.mapEvents.$broadcast("searchchange");
			};

			scope.showMapResult = function(result) {
				console.log(result);

				if(result.kind == "marker")
					_flyTo([ result.lat, result.lon ], 15);
				else if(result.kind == "line") {
					let bounds = fmUtils.fmToLeafletBbox(result);
					_flyTo(bounds.getCenter(), Math.min(15, map.map.getBoundsZoom(bounds)));
				}
			};

			scope.zoomToAll = function() {
				_flyTo(...getZoomDestination());
			};

			scope.showRoutingForm = function() {
				if(scope.searchString.match(/ to /i)) {
					var spl = fmUtils.splitRouteQuery(scope.searchString);
					searchUi.routeUi.setQueries(spl.queries);
					if(spl.mode)
						searchUi.routeUi.setMode(spl.mode == "helicopter" ? "" : spl.mode);
				} else if(!searchUi.routeUi.getTypedQueries()[0]) {
					if(scope.searchResults && scope.submittedSearchString == scope.searchString)
						searchUi.routeUi.setFrom(scope.searchString, scope.searchResults.features, scope.activeResult);
					else
						searchUi.routeUi.setFrom(scope.searchString);
				}

				map.searchUi.showRoute();
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
					if(["name", "type", "defaultColour", "colourFixed", "defaultSize", "sizeFixed", "defaultSymbol", "symbolFixed", "defaultShape", "shapeFixed", "defaultWidth", "widthFixed", "defaultMode", "modeFixed", "fields"].filter((idx) => !ng.equals(type[idx], map.client.types[typeId][idx])).length == 0)
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

			if (scope.autofocus) {
				$("#fm-search-input", el).attr("autofocus", "autofocus");
			}


			el.find(".fm-search-results").resizable({
				handles: {
					se: el.find(".fm-search-resize")
				},
				minHeight: 0
			}).one("resize", () => {
				el.addClass("fm-search-resized");
			}).on("resize", () => {
				el.css("width", `${el.find(".fm-search-results").innerWidth()}px`);
			});


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

			function getZoomDestination(result, unionZoom) {
				let forBounds = (bounds) => ([
					bounds.getCenter(),
					Math.min(15, map.map.getBoundsZoom(bounds))
				]);

				if(!result) // Zoom to all
					return forBounds(layerGroup.getBounds());
				else if(unionZoom) { // Zoom to item, keep current map bounding box in view
					if(result.boundingbox)
						return forBounds(map.map.getBounds().extend(L.latLngBounds([ [ result.boundingbox[0], result.boundingbox[3 ] ], [ result.boundingbox[1], result.boundingbox[2] ] ])));
					else if(result.layer)
						return forBounds(map.map.getBounds().extend(result.layer.getBounds()));
					else if(result.lat != null && result.lon != null)
						return forBounds(map.map.getBounds().extend(L.latLng(result.lat, result.lon)));
				} else { // Zoom to item
					if(result.lat && result.lon && result.zoom) {
						return [ L.latLng(1*result.lat, 1*result.lon), 1*result.zoom ];
					} else if(result.boundingbox)
						return forBounds(L.latLngBounds([ [ result.boundingbox[0], result.boundingbox[3 ] ], [ result.boundingbox[1], result.boundingbox[2] ] ]));
					else if(result.layer)
						return forBounds(result.layer.getBounds());
				}
			}

			function _flyTo(center, zoom) {
				if(map.map.getBounds().getCenter().equals(center)) // map.getCenter() is different from map.getBounds().getCenter()
					return;

				map.map.flyTo(center, zoom);
			}

			function prepareResults(results) {
				for(let result of results) {
					if((result.lat != null && result.lon != null) || result.geojson && result.geojson.type == "Point")
						result.isMarker = true;
					if([ "LineString", "MultiLineString", "Polygon", "MultiPolygon" ].indexOf(result.geojson && result.geojson.type) != -1)
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
								icon: fmUtils.createMarkerIcon("ff0000", 35, null, null, null, highlight),
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
									icon: fmUtils.createMarkerIcon("ff0000", 35, null, null, null, highlight),
									pane: highlight ? "fmHighlightMarkerPane" : "markerPane"
								});
							},
							style: (feature) => ({
								color: '#000000',
								fill: false,
								weight: 6
							})
						})
							.on("click", function(e) {
								renderResult(query, results, result, true, layerGroup, onOpen, onClose, true);
								onOpen && onOpen();
							}.fmWrapApply($rootScope));

						layerGroup.addLayer(result.highlightLayer);
					}
				}

				if(result.lat != null && result.lon != null) {
					result.marker = L.marker([ result.lat, result.lon ], {
						pane: highlight ? "fmHighlightMarkerPane" : "markerPane",
						icon: fmUtils.createMarkerIcon(map.searchMarkerColour, 35, result.icon, null, null, highlight)
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
					map.searchUi.setRouteDestination(query, mode, results, result);
				};

				currentInfoBox = map.infoBox.show(require("./result-popup.html"), popupScope, () => {
					popupScope.$destroy();

					onClose && onClose();
					currentInfoBox = null;
				});
			}

			var queryUi = searchUi.queryUi = {
				show: function() {
					el.show();
				},

				hide: function() {
					scope.reset();
					el.hide();
				},

				search: function(query, noZoom, showAll) {
					if(query != null)
						scope.searchString = query;

					if(showAll != null)
						scope.showAll = showAll;

					scope.search(noZoom);
				},

				showFiles: function(files) {
					scope.submittedSearchString = "";
					scope.showAll = true;
					loadSearchResults(filesUi.parseFiles(files));
				},

				getCurrentSearchForHash: function() {
					if(((scope.searchResults && scope.searchResults.features.length == 1) || !scope.showAll) && scope.activeResult && scope.activeResult.id)
						return scope.activeResult.id;
					else if(scope.submittedSearchString)
						return scope.submittedSearchString;
				},

				isZoomedToCurrentResult: function() {
					if(scope.showAll || !scope.activeResult)
						return false;

					let [center, zoom] = scope.showAll ? getZoomDestination() : getZoomDestination(scope.activeResult);
					return map.map.getZoom() == zoom && fmUtils.pointsEqual(map.map.getCenter(), center, map.map);
				},

				hasResults: function() {
					return !!scope.searchResults;
				}
			};

			scope.$on("$destroy", () => {
				scope.reset();
				searchUi.searchUi = null;
			});

			var filesUi = fmSearchFiles(map);
			var importUi = fmSearchImport(map);
		}
	};
});
