import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import '../../../assets/font/fontello.css';
import 'jquery-ui';
import 'jquery-ui/ui/widgets/resizable';

fm.app.factory("fmMapSearch", function($rootScope, $compile, fmUtils, $timeout, $q, fmMapSearchRoute, fmMapSearchFiles, fmMapSearchImport) {
	return function(map) {
		var iconSuffix = ".n.32.png";

		var scope = $rootScope.$new(true);
		scope.searchString = "";
		scope.submittedSearchString = "";
		scope.searchResults = null;
		scope.showAll = false;
		scope.activeResult = null;
		scope.socket = map.socket;

		scope.$watch("activeResult", () => {
			setTimeout(() => {
				let activeResultEl = el.find(".fm-search-results .active");
				if(activeResultEl.length > 0)
					fmUtils.scrollIntoView(activeResultEl, el.find(".fm-search-results"));
			}, 0);
		});

		scope.search = function(noZoom) {
			reset();

			if(scope.searchString.trim() != "") {
				if(scope.searchString.match(/ to /)) {
					scope.showRoutingForm();
					return routeUi.submit();
				}

				var lonlat = fmUtils.decodeLonLatUrl(scope.searchString);
				if(lonlat)
					return map.map.flyTo([ lonlat.lat, lonlat.lon ], lonlat.zoom);

				var q = scope.submittedSearchString = scope.searchString;
				map.mapEvents.$emit("searchchange");

				map.socket.find({ query: scope.searchString, loadUrls: true }).then(function(results) {
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
				map.mapEvents.$emit("searchchange");
		};

		scope.showResult = function(result, noZoom) {
			if(scope.showAll && scope.searchResults && scope.searchResults.features.length > 1) {
				result.marker ? result.marker.openPopup() : result.layer.openPopup();
			} else {
				clearRenders();
				renderResult(scope.submittedSearchString, scope.searchResults.features, result, true, layerGroup, function() { scope.activeResult = result; }, noZoom);
			}

			if(!noZoom)
				scope.zoomToResults();

			map.mapEvents.$emit("searchchange");
		};

		scope.showAllResults = function(noZoom) {
			clearRenders();

			scope.searchResults.features.forEach(function(result) {
				renderResult(scope.submittedSearchString, scope.searchResults.features, result, false, layerGroup, function() { scope.activeResult = result; });
			});

			if(!noZoom)
				scope.zoomToResults();

			map.mapEvents.$emit("searchchange");
		};

		scope.showRoutingForm = function() {
			searchUi.hide();
			routeUi.show();

			if(scope.searchString.match(/ to /)) {
				var spl = fmUtils.splitRouteQuery(scope.searchString);
				routeUi.setQueries(spl.queries);
				if(spl.mode)
					routeUi.setMode(spl.mode);
			} else if(scope.submittedSearchString == scope.searchString)
				routeUi.setFrom(scope.searchString, scope.searchResults.features, scope.activeResult);
			else
				routeUi.setFrom(scope.searchString);
		};

		scope.zoomToResults = function() {
			if(scope.showAll && scope.searchResults && scope.searchResults.features.length > 1)
				_flyToBounds(layerGroup.getBounds());
			else if(scope.activeResult) {
				if(scope.activeResult.lat && scope.activeResult.lon && scope.activeResult.zoom)
					map.map.flyTo([ scope.activeResult.lat, scope.activeResult.lon ], scope.activeResult.zoom);
				else if(scope.activeResult.boundingbox)
					_flyToBounds(L.latLngBounds([ [ scope.activeResult.boundingbox[0], scope.activeResult.boundingbox[3 ] ], [ scope.activeResult.boundingbox[1], scope.activeResult.boundingbox[2] ] ]));
				else if(scope.activeResult.layer)
					_flyToBounds(scope.activeResult.layer.getBounds());
			}
		};

		scope.$watch("showAll", function() {
			if(!scope.searchResults)
				return;

			if(scope.showAll)
				scope.showAllResults(true);
			 else if(scope.searchResults.features.length > 0)
				scope.showResult(scope.activeResult || scope.searchResults.features[0], true);
		});

		scope.showView = function(view) {
			map.displayView(view);
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

		var el = $(require("./search.html")).insertAfter(map.map.getContainer());
		$compile(el)(scope);
		scope.$evalAsync(); // $compile only replaces variables on next digest

		var clickMarker = L.featureGroup([]).addTo(map.map);
		clickMarker.on("popupclose", function() {
			clickMarker.clearLayers();
		});

		map.mapEvents.$on("longmousedown", function(e, latlng) {
			var mouseUpHasHappened = false;
			map.map.once("mouseup", function() { setTimeout(function() {
				mouseUpHasHappened = true;
				fmUtils.setCloseOnClick(clickMarker, null); // Reset to default
			}, 0); });

			clickMarker.clearLayers();

			map.socket.find({ query: "geo:" + fmUtils.round(latlng.lat, 5) + "," + fmUtils.round(latlng.lng, 5) + "?z=" + map.map.getZoom(), loadUrls: false }).then(function(results) {
				clickMarker.clearLayers();

				if(results.length > 0) {
					renderResult(fmUtils.round(latlng.lat, 5) + "," + fmUtils.round(latlng.lng, 5), results, results[0], true, clickMarker);

					// Prevent closing popup on mouseup because of map.options.closePopupOnClick
					if(!mouseUpHasHappened)
						fmUtils.setCloseOnClick(clickMarker, false);
				}
			}).catch(function(err) {
				map.messages.showMessage("danger", err);
			});
		});

		var layerGroup = L.featureGroup([]).addTo(map.map);

		function _flyToBounds(bounds) {
			map.map.flyTo(bounds.getCenter(), Math.min(15, map.map.getBoundsZoom(bounds)));
		}

		function loadSearchResults(results, noZoom) {
			clearRenders();

			scope.searchResults = results;

			if(results && results.features.length > 0) {
				for(let result of results.features) {
					if((result.lat != null && result.lon != null) || result.geojson && result.geojson.type == "Point")
						result.isMarker = true;
					if([ "LineString", "MultiLineString", "Polygon" ].indexOf(result.geojson && result.geojson.type) != -1)
						result.isLine = true;
				}

				(scope.showAll && results.features.length > 1) ? scope.showAllResults(noZoom) : scope.showResult(scope.searchResults.features[0], noZoom);
			}
		}

		function renderResult(query, results, result, showPopup, layerGroup, onOpen, noZoom) {
			if(!result.lat || !result.lon || (result.geojson && result.geojson.type != "Point")) { // If the geojson is just a point, we already render our own marker
				result.layer = L.geoJson(result.geojson, {
					pointToLayer: function(geoJsonPoint, latlng) {
					    return L.marker(latlng, {
					        icon: fmUtils.createMarkerIcon("ff0000", 35)
					    });
					}
				})
				.bindPopup($("<div/>")[0], map.popupOptions)
				.on("popupopen", function(e) {
					renderResultPopup(query, results, result, e.popup);
					onOpen && onOpen();
				}.fmWrapApply(scope))
				.on("popupclose", function(e) {
					ng.element(e.popup.getContent()).scope().$destroy();
				})
				.bindTooltip(result.display_name, $.extend({}, map.tooltipOptions, { sticky: true, offset: [ 20, 0 ] }));

				layerGroup.addLayer(result.layer);
			}

			if(result.lat != null && result.lon != null) {
				result.marker = L.marker([ result.lat, result.lon ], {
					icon: fmUtils.createMarkerIcon(map.searchMarkerColour, 35, result.icon)
				})
					.bindPopup($("<div/>")[0], map.popupOptions)
					.on("popupopen", function(e) {
						renderResultPopup(query, results, result, e.popup);
						onOpen && onOpen();
					}.fmWrapApply(scope))
					.on("popupclose", function(e) {
						ng.element(e.popup.getContent()).scope().$destroy();
					})
					.bindTooltip(result.display_name, $.extend({}, map.tooltipOptions, { offset: [ 20, 0 ] }));

				layerGroup.addLayer(result.marker);
			}

			if(showPopup) {
				var popupLayer = result.marker || result.layer;
				if(popupLayer) {
					if(noZoom)
						popupLayer._popup.options.autoPan = false;
					popupLayer.openPopup();
				}
			}
		}

		function reset() {
			scope.searchResults = null;
			scope.activeResult = null;
			scope.submittedSearchString = "";
			clearRenders();
		}

		function clearRenders() {
			layerGroup.clearLayers();
		}

		function renderResultPopup(query, results, result, popup) {
			var popupScope = map.socket.$new();

			popupScope.result = result;

			popupScope.addToMap = function(type) {
				scope.addResultToMap(result, type);
			};

			popupScope.useForRoute = function(mode) {
				searchUi.hide();
				routeUi.show();

				if(mode == 1)
					routeUi.setFrom(query, results, result);
				else if(mode == 2)
					routeUi.addVia(query, results, result);
				else if(mode == 3)
					routeUi.setTo(query, results, result);

				routeUi.submit();

				popup.closePopup();
			};

			var el = popup.getContent();
			$(el).html(require("./result-popup.html"));
			$compile(el)(popupScope);

			// Prevent popup close on button click
			$("button", el).click(function(e) {
				e.preventDefault();
			});

			$timeout(function() { $timeout(function() { // $compile only replaces variables on next digest
				popup.update();

				// Might have been set to false in renderResult() if noZoom
				popup.options.autoPan = true;
			}); });
		}

		var searchUi = {
			_el: el.filter(".fm-search"),

			show: function() {
				searchUi._el.show();
				map.mapEvents.$emit("searchchange");
			},

			hide: function() {
				reset();
				searchUi._el.hide();
				map.mapEvents.$emit("searchchange");
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

			route: function(destinations, mode, noZoom) {
				searchUi.hide();
				routeUi.show();

				routeUi.setQueries(destinations);
				if(mode)
					routeUi.setMode(mode);

				routeUi.submit(noZoom);
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
			}
		};

		var routeUi = fmMapSearchRoute(map, searchUi);
		var filesUi = fmMapSearchFiles(map, searchUi);
		var importUi = fmMapSearchImport(map);

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
