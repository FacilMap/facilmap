(function(fm, $, ng, undefined) {

	fm.app.factory("fmMapSearchRoute", function($rootScope, $templateCache, $compile, fmUtils, L, $timeout, $q, fmSortableOptions) {
		return function(map, searchUi) {
			var lineStyle = {
				color : '#0000ff',
				weight : 8,
				opacity : 0.7
			};

			var dragTimeout = 300;

			var scope = map.socket.$new();

			scope.routeMode = 'car';
			scope.destinations = [ ];
			scope.submittedQueries = null;
			scope.submittedMode = null;

			scope.sortableOptions = ng.copy(fmSortableOptions);
			scope.sortableOptions.update = function() {
				scope.reroute();
			};

			scope.addDestination = function() {
				scope.destinations.push({
					query: "",
					loadingQuery: "",
					loadedQuery: "",
					suggestions: [ ]
				});
			};

			scope.addDestination();
			scope.addDestination();

			scope.removeDestination = function(idx) {
				scope.destinations.splice(idx, 1);
				scope.reroute();
			};

			scope.showSearchForm = function() {
				routeUi.hide();
				searchUi.show();
			};

			scope.loadSuggestions = function(destination) {
				if(destination.loadedQuery == destination.query)
					return $q.resolve();

				destination.suggestions = [ ];
				var query = destination.loadingQuery = destination.query;

				if(destination.query.trim() != "") {
					return map.socket.emit("find", { query: query }).then(function(results) {
						if(query != destination.loadingQuery)
							return; // The destination has changed in the meantime

						if(fmUtils.isSearchId(query) && results.length > 0 && results[0].display_name)
							destination.query = query = results[0].display_name;

						destination.suggestions = results;
						destination.loadedQuery = query;
						destination.selectedSuggestionIdx = 0;
					}).catch(function(err) {
						map.messages.showMessage("danger", err);
					});
				}
			};

			scope.route = function(dragging, noZoom) {
				if(!dragging)
					scope.reset();

				if(scope.destinations[0].query.trim() == "" || scope.destinations[scope.destinations.length-1].query.trim() == "")
					return;

				var points;
				var mode = scope.routeMode;

				scope.submittedQueries = scope.destinations.map(function(destination) {
					if(destination.loadedQuery == destination.query && destination.suggestions.length)
						return destination.suggestions[destination.selectedSuggestionIdx].id || destination.suggestions[0].id;
					else
						return destination.query;
				});
				scope.submittedMode = mode;

				map.mapEvents.$emit("searchchange");

				return $q.all(scope.destinations.map(scope.loadSuggestions)).then(function() {
					points = scope.destinations.filter(function(destination) {
						return destination.query.trim() != "";
					}).map(function(destination) {
						if(destination.suggestions.length == 0)
							throw "No place has been found for search term “" + destination.query + "”.";

						return destination.suggestions[destination.selectedSuggestionIdx] || destination.suggestions[0];
					});

					scope.submittedQueries = points.map(function(point) {
						return point.id;
					});

					map.mapEvents.$emit("searchchange");

					return map.socket.emit("getRoute", { destinations: points.map(function(point) { return { lat: point.lat, lon: point.lon }; }), mode: mode });
				}).then(function(route) {
					route.routePoints = points;
					route.routeMode = mode;

					scope.routeObj = route;
					scope.routeError = null;
					renderRoute(dragging, noZoom);
				}).catch(function(err) {
					scope.routeError = err;
				});
			};

			scope.reroute = function() {
				if(scope.routeObj || scope.routeError)
					scope.route();
			};

			scope.reset = function() {
				scope.routeObj = null;
				scope.routeError = null;
				scope.submittedQueries = null;
				scope.submittedMode = null;

				clearRoute();
			};

			scope.clear = function() {
				scope.reset();

				scope.destinations = [ ];
				scope.addDestination();
				scope.addDestination();
			};

			scope.addToMap = function(type) {
				if(type == null) {
					for(var i in map.socket.types) {
						if(map.socket.types[i].type == "line") {
							type = map.socket.types[i];
							break;
						}
					}
				}

				map.linesUi.createLine(type, scope.routeObj.routePoints.map(function(point) { return { lat: point.lat, lon: point.lon }; }), { mode: scope.routeObj.routeMode });

				scope.clear();
			};

			var el = $($templateCache.get("map/search/search-route.html")).appendTo(searchUi._el);
			$compile(el)(scope);
			scope.$evalAsync(); // $compile only replaces variables on next digest

			var routeLayer = null;
			var dragMarker = null;
			var markers = [ ];
			var recalcRoute = fmUtils.minInterval(dragTimeout, false);

			function renderRoute(dragging, noZoom) {
				clearRoute(dragging);

				routeLayer = L.polyline(scope.routeObj.trackPoints.map(function(it) { return [ it.lat, it.lon ] }), lineStyle).addTo(map.map);
				map.map.almostOver.addLayer(routeLayer);

				dragMarker = fmUtils.temporaryDragMarker(map.map, routeLayer, map.dragMarkerColour, function(marker) {
					var latlng = marker.getLatLng();
					var idx = fmUtils.getIndexOnLine(map.map, scope.routeObj.trackPoints, scope.routeObj.routePoints, { lat: latlng.lat, lon: latlng.lng });

					scope.destinations.splice(idx, 0, makeCoordDestination(latlng));
					markers.splice(idx, 0, marker);

					registerMarkerHandlers(marker);

					marker.once("dragend", updateMarkerColours);

					scope.route(true);
				}.fmWrapApply(scope));

				if(!dragging) {
					if(!noZoom)
						map.map.flyToBounds(routeLayer.getBounds());

					// Render markers

					scope.routeObj.routePoints.forEach(function(point, i) {
						var marker = L.marker([ point.lat, point.lon ], {
							icon: fmUtils.createMarkerIcon(map.dragMarkerColour, 35),
							draggable: true
						}).addTo(map.map);

						registerMarkerHandlers(marker);

						markers.push(marker);
					});

					updateMarkerColours();
				}
			}

			function registerMarkerHandlers(marker) {
				marker.on("dblclick", function() {
					scope.$apply(function() {
						scope.removeDestination(markers.indexOf(marker));
					});
				})
				.on("drag", function() {
					recalcRoute(function() {
						scope.destinations[markers.indexOf(marker)] = makeCoordDestination(marker.getLatLng());

						return scope.route(true);
					}.fmWrapApply(scope));
				});
			}

			function updateMarkerColours() {
				markers.forEach(function(marker, i) {
					var colour = (i == 0 ? map.startMarkerColour : i == markers.length-1 ? map.endMarkerColour : map.dragMarkerColour);

					marker.setIcon(fmUtils.createMarkerIcon(colour, 35));
				});
			}

			function clearRoute(dragging) {
				if(routeLayer) {
					map.map.almostOver.removeLayer(routeLayer);
					routeLayer.remove();
					routeLayer = null;
				}

				if(dragMarker) {
					dragMarker();
					dragMarker = null;
				}

				if(!dragging) {
					markers.forEach(function(marker) {
						marker.remove();
					});
					markers = [ ];
				}
			}

			function makeCoordDestination(latlng) {
				var disp = fmUtils.round(latlng.lat, 5) + "," + fmUtils.round(latlng.lng, 5);
				return {
					query: disp,
					loadingQuery: disp,
					loadedQuery: disp,
					selectedSuggestionIdx: 0,
					suggestions: [ {
						lat: latlng.lat,
						lon: latlng.lng,
						display_name: disp,
						short_name: disp,
						type: "coordinates",
						id: disp
					} ]
				};
			}

			function _setDestination(dest, query, suggestions, selectedSuggestion) {
				dest.query = query;

				if(suggestions) {
					dest.suggestions = suggestions;
					dest.loadingQuery = dest.loadedQuery = query;
					dest.selectedSuggestionIdx = Math.max(suggestions.indexOf(selectedSuggestion), 0);
				}
			}

			var routeUi = {
				show: function() {
					el.show();
				},

				hide: function() {
					scope.reset();
					el.hide();
				},

				setQueries: function(queries) {
					scope.clear();

					for(var i=0; i<queries.length; i++) {
						if(scope.destinations.length <= i)
							scope.addDestination();

						$.extend(scope.destinations[i], typeof queries[i] == "object" ? queries[i] : { query: queries[i] });
					}
				},

				setFrom: function(from, suggestions, selectedSuggestion) {
					_setDestination(scope.destinations[0], from, suggestions, selectedSuggestion);
				},

				addVia: function(via, suggestions, selectedSuggestion) {
					scope.addDestination();
					var newDest = scope.destinations.pop();
					_setDestination(newDest, via, suggestions, selectedSuggestion);
					scope.destinations.splice(scope.destinations.length-1, 0, newDest);
				},

				setTo: function(to, suggestions, selectedSuggestion) {
					_setDestination(scope.destinations[scope.destinations.length-1], to, suggestions, selectedSuggestion);
				},

				setMode: function(mode) {
					scope.routeMode = mode;
				},

				getQueries: function() {
					return scope.submittedQueries;
				},

				getMode: function() {
					return scope.submittedMode;
				},

				submit: function(noZoom) {
					scope.route(false, noZoom);
				}
			};
			routeUi.hide();
			return routeUi;
		};
	});

})(FacilMap, jQuery, angular);