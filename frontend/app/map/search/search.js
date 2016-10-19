(function(fm, $, ng, undefined) {

	fm.app.factory("fmMapSearch", function($rootScope, $templateCache, $compile, fmUtils, L, $timeout, $q, fmMapSearchRoute) {
		return function(map) {
			var iconSuffix = ".n.32.png";

			var scope = $rootScope.$new(true);
			scope.searchString = "";
			scope.loadedSearchString = "";
			scope.searchResults = null;
			scope.showAll = false;
			scope.activeResult = null;

			scope.search = function(noZoom) {
				scope.searchResults = null;
				scope.loadedSearchString = "";
				clearRenders();

				if(scope.searchString.trim() != "") {
					if(scope.searchString.match(/ to /)) {
						scope.showRoutingForm();
						return routeUi.submit();
					}

					var lonlat = fmUtils.decodeLonLatUrl(scope.searchString);
					if(lonlat)
						return map.map.flyTo([ lonlat.lat, lonlat.lon ], lonlat.zoom);

					var q = scope.searchString;
					map.loadStart();
					map.socket.emit("find", { query: scope.searchString, loadUrls: true }, function(err, results) {
						map.loadEnd();

						if(err)
							return map.messages.showMessage("danger", err);

						if(fmUtils.isSearchId(q) && results.length > 0 && results[0].display_name)
							scope.searchString = q = results[0].display_name;

						scope.loadedSearchString = q;

						map.mapEvents.$emit("searchchange");

						if(typeof results == "string")
							loadSearchResults(parseFiles([ results ]), noZoom);
						else
							loadSearchResults(results, noZoom);
					});
				}
			};

			scope.showResult = function(result, noZoom) {
				if(scope.showAll) {
					if(!noZoom)
						_flyToBounds(layerGroup.getBounds());

					result.marker ? result.marker.openPopup() : result.layer.openPopup();
				} else {
					clearRenders();
					renderResult(scope.loadedSearchString, scope.searchResults, result, true, layerGroup);

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

				for(var i=0; i<scope.searchResults.length; i++)
					renderResult(scope.loadedSearchString, scope.searchResults, scope.searchResults[i], false, layerGroup);

				if(!noZoom)
					_flyToBounds(layerGroup.getBounds());

				map.mapEvents.$emit("searchchange");
			};

			scope.showRoutingForm = function() {
				searchUi.hide();
				routeUi.show();

				if(scope.searchString.match(/ to /))
					routeUi.setQueries(fmUtils.splitRouteQuery(scope.searchString));
				else if(scope.loadedSearchString == scope.searchString)
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

			map.mapEvents.$on("longclick", function(e, latlng) {
				clickMarker.clearLayers();

				map.loadStart();
				map.socket.emit("find", { query: "geo:" + latlng.lat + "," + latlng.lng + "?z=" + map.map.getZoom(), loadUrls: false }, function(err, results) {
					map.loadEnd();

					if(err)
						return map.messages.showMessage("danger", err);

					clickMarker.clearLayers();

					if(results.length > 0)
						renderResult(fmUtils.round(latlng.lat, 5) + "," + fmUtils.round(latlng.lng, 5), results, results[0], true, clickMarker);
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
					scope.showAll ? scope.showAllResults(noZoom) : scope.showResult(scope.searchResults[0], noZoom);
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

			function renderResult(query, results, result, showPopup, layerGroup) {
				if(!result.lat || !result.lon || (result.geojson && result.geojson.type != "Point")) { // If the geojson is just a point, we already render our own marker
					result.layer = L.geoJson(result.geojson, {
						pointToLayer: function(geoJsonPoint, latlng) {
						    return L.marker(latlng, {
						    	icon: fmUtils.createMarkerIcon("ff0000")
						    });
						}
					})
					.bindPopup($("<div/>")[0], map.popupOptions)
					.on("popupopen", function(e) {
						scope.activeResult = result;
						renderResultPopup(query, results, result, e.popup);
					})
					.on("popupclose", function(e) {
						ng.element(e.popup.getContent()).scope().$destroy();
					})
					.bindTooltip(result.display_name, $.extend({}, map.tooltipOptions, { sticky: true, offset: [ 20, 0 ] }));

					layerGroup.addLayer(result.layer);
				}

				if(result.lat != null && result.lon != null) {
					result.marker = L.marker([ result.lat, result.lon ], {
						icon: L.icon({
							iconUrl: result.icon.replace(/\.[a-z]+\.[0-9]+\.png$/, iconSuffix),
							iconSize: [ 32, 32 ],
							iconAnchor: [ 16, 16 ],
							popupAnchor: [ 0, -16 ]
						})
					})
						.bindPopup($("<div/>")[0], map.popupOptions)
						.on("popupopen", function(e) {
							scope.activeResult = result;
							renderResultPopup(query, results, result, e.popup);
						})
						.on("popupclose", function(e) {
							ng.element(e.popup.getContent()).scope().$destroy();
						})
						.bindTooltip(result.display_name, $.extend({}, map.tooltipOptions, { offset: [ 20, 0 ] }));

					layerGroup.addLayer(result.marker);
				}

				if(showPopup) {
					if(result.marker)
						result.marker.openPopup();
					else if(result.layer)
						result.layer.openPopup();
				}
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
				}); });
			}

			var searchUi = {
				show: function() {
					el.show();

					if(scope.searchResults) {
						if(scope.showAll)
							scope.showAllResults();
						 else if(scope.searchResults.length > 0)
							scope.showResult(scope.activeResult || scope.searchResults[0]);
					}
				},

				hide: function() {
					clearRenders();
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
					if(el.is(":visible")) {
						if(!scope.showAll && scope.activeResult && scope.activeResult.id)
							return [ scope.activeResult.id ];
						else if(scope.loadedSearchString)
							return [ scope.loadedSearchString ];
					} else {
						var queries = routeUi.getQueries();
						if(queries)
							return queries.concat([ routeUi.getMode() ]);
					}
				}
			};

			var routeUi = fmMapSearchRoute(map, searchUi);

			return searchUi;
		};
	});

})(FacilMap, jQuery, angular);