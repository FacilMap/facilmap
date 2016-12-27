(function(fm, $, ng, undefined) {

	fm.app.factory("fmMapSearch", function($rootScope, $templateCache, $compile, fmUtils, L, $timeout, $q, fmMapSearchRoute) {
		return function(map) {
			var iconSuffix = ".n.32.png";

			var scope = $rootScope.$new(true);
			scope.searchString = "";
			scope.submittedSearchString = "";
			scope.searchResults = null;
			scope.showAll = false;
			scope.activeResult = null;

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

					map.socket.emit("find", { query: scope.searchString, loadUrls: true }).then(function(results) {
						if(q != scope.submittedSearchString)
							return; // Another search has been started in the meantime

						if(fmUtils.isSearchId(q) && results.length > 0 && results[0].display_name)
							scope.searchString = q = results[0].display_name;

						if(typeof results == "string")
							loadSearchResults(parseFiles([ results ]), noZoom);
						else
							loadSearchResults(results, noZoom);
					}).catch(function(err) {
						map.messages.showMessage("danger", err);
					});
				} else
					map.mapEvents.$emit("searchchange");
			};

			scope.showResult = function(result, noZoom) {
				if(scope.showAll && scope.searchResults.length > 1) {
					if(!noZoom)
						_flyToBounds(layerGroup.getBounds());

					result.marker ? result.marker.openPopup() : result.layer.openPopup();
				} else {
					clearRenders();
					renderResult(scope.submittedSearchString, scope.searchResults, result, true, layerGroup, function() { scope.activeResult = result; }, noZoom);

					if(!noZoom) {
						if(result.lat && result.lon && result.zoom)
							map.map.flyTo([ result.lat, result.lon ], result.zoom);
						else if(result.boundingbox)
							_flyToBounds(L.latLngBounds([ [ result.boundingbox[0], result.boundingbox[3 ] ], [ result.boundingbox[1], result.boundingbox[2] ] ]));
						else if(result.layer)
							_flyToBounds(result.layer.getBounds());
					}
				}

				map.mapEvents.$emit("searchchange");
			};

			scope.showAllResults = function(noZoom) {
				clearRenders();

				scope.searchResults.forEach(function(result) {
					renderResult(scope.submittedSearchString, scope.searchResults, result, false, layerGroup, function() { scope.activeResult = result; });
				});

				if(!noZoom)
					_flyToBounds(layerGroup.getBounds());

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
					routeUi.setFrom(scope.searchString, scope.searchResults, scope.activeResult);
				else
					routeUi.setFrom(scope.searchString);
			};

			scope.$watch("showAll", function() {
				if(!scope.searchResults)
					return;

				if(scope.showAll)
					scope.showAllResults();
				 else if(scope.searchResults.length > 0)
					scope.showResult(scope.activeResult || scope.searchResults[0]);
			});

			var el = $($templateCache.get("map/search/search.html")).insertAfter(map.map.getContainer());
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

				map.socket.emit("find", { query: "geo:" + fmUtils.round(latlng.lat, 5) + "," + fmUtils.round(latlng.lng, 5) + "?z=" + map.map.getZoom(), loadUrls: false }).then(function(results) {
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

				if(results && results.length > 0)
					(scope.showAll && results.length > 1) ? scope.showAllResults(noZoom) : scope.showResult(scope.searchResults[0], noZoom);
			}

			function parseFiles(files) {
				var ret = [ ];
				var errors = false;
				files.forEach(function(file) {
					var geojson = null;

					if(file.match(/^\s*</)) {
						var doc = $.parseXML(file);
						var xml = $(doc).find(":root");

						if(xml.is("gpx"))
							geojson = toGeoJSON.gpx(xml[0]);
						else if(xml.is("kml"))
							geojson = toGeoJSON.kml(xml[0]);
						else if(xml.is("osm"))
							geojson = osmtogeojson(doc);
					} else if(body.match(/^\s*\{/)) {
						var content = JSON.parse(body);
						if(content.type)
							return geojson = content;
					}

					if(geojson == null)
						return errors = true;

					var features;
					if(geojson.type == "FeatureCollection")
						features = geojson.features || [ ];
					else if(geojson.type == "Feature")
						features = [ geojson ];
					else
						features = [ { type: "Feature", geometry: geojson, properties: { } } ];

					features.forEach(function(feature) {
						var name;

						if(typeof feature.properties != "object")
							feature.properties = { };

						if(feature.properties.name)
							name = feature.properties.name;
						else if(feature.properties.tags.name)
							name = feature.properties.tags.name;
						else if(feature.properties.type)
							name = feature.properties.type + " " + feature.properties.id;
						else if([ "Polygon", "MultiPolygon" ].indexOf(feature.geometry.type) != -1)
							name = "Polygon";
						else if([ "LineString", "MultiLineString" ].indexOf(feature.geometry.type) != -1)
							name = "Line";
						else if([ "Point", "MultiPoint" ].indexOf(feature.geometry.type) != -1)
							name = "Point";
						else
							name = feature.geometry.type || "Object";

						ret.push({
							short_name: name,
							display_name: name,
							extratags: feature.properties.tags || _filterAdditionalTags(feature.properties),
							geojson: feature.geometry,
							type: feature.properties.type || feature.geometry.type
						});
					});
				});

				if(errors)
					return map.messages.showMessage("danger", "Some files could not be parsed.");

				return ret;
			}

			function _filterAdditionalTags(tags) {
				var ret = { };
				for(var i in tags) {
					if(typeof tags[i] == "string" || typeof tags[i] == "number")
						ret[i] = tags[i];
				}
				return ret;
			}

			function _lineStringToTrackPoints(geometry) {
				var ret = [ ];
				var coords = (geometry.type == "MultiLineString" ? geometry.coordinates : [ geometry.coordinates ]);
				coords.forEach(function(linePart) {
					linePart.forEach(function(latlng) {
						ret.push({ lat: latlng[1], lon: latlng[0] });
					});
				});
				return ret;
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
				var scope = map.socket.$new();

				scope.result = result;

				if((result.lat != null && result.lon != null) || result.geojson && result.geojson.type == "Point")
					scope.type = "marker";
				else if([ "LineString", "MultiLineString" ].indexOf(result.geojson && result.geojson.type) != -1)
					scope.type = "line";

				scope.addToMap = function(type) {
					if(type == null) {
						for(var i in map.socket.types) {
							if(map.socket.types[i].type == scope.type) {
								type = map.socket.types[i];
								break;
							}
						}
					}

					if(scope.type == "marker")
						map.markersUi.createMarker(result.lat != null && result.lon != null ? result : { lat: result.geojson.coordinates[1], lon: result.geojson.coordinates[0] }, type, { name: result.display_name });
					else if(scope.type == "line") {
						var trackPoints = _lineStringToTrackPoints(result.geojson);
						map.linesUi.createLine(type, [ trackPoints[0], trackPoints[trackPoints.length-1] ], { trackPoints: trackPoints, mode: "track" });
					}
				};

				scope.useForRoute = function(mode) {
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
				$(el).html($templateCache.get("map/search/result-popup.html"));
				$compile(el)(scope);

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
					loadSearchResults(parseFiles(files));
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
						if(((scope.searchResults && scope.searchResults.length == 1) || !scope.showAll) && scope.activeResult && scope.activeResult.id)
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

			return searchUi;
		};
	});

})(FacilMap, jQuery, angular);