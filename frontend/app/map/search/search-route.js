(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapSearchRoute", function($rootScope, $templateCache, $compile, fpUtils, L, $timeout, $q) {
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

			scope.sortableOptions = ng.copy($rootScope.sortableOptions);
			scope.sortableOptions.update = function() {
				scope.reroute();
			};

			scope.addDestination = function() {
				scope.destinations.push({
					query: "",
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
				return $q(function(resolve, reject) {
					if(destination.suggestionQuery == destination.query)
						return resolve();

					destination.suggestions = [ ];
					destination.suggestionQuery = null;
					destination.selectedSuggestionIdx = null;
					if(destination.query.trim() != "") {
						var query = destination.query;

						map.loadStart();
						map.socket.emit("find", { query: query }, function(err, results) {
							map.loadEnd();

							if(err) {
								map.messages.showMessage("danger", err);
								return reject(err);
							}

							destination.suggestions = results;
							destination.suggestionQuery = query;
							destination.selectedSuggestionIdx = 0;

							resolve();
						});
					}
				});
			};

			scope.route = function(dragging) {
				if(!dragging)
					scope.reset();

				var points;
				var mode = scope.routeMode;

				return $q.all(scope.destinations.map(scope.loadSuggestions)).then(function() {
					points = scope.destinations.map(function(destination) {
						if(destination.suggestions.length == null)
							throw "No place has been found for search term “" + destination.query + "”.";

						var sug = destination.suggestions[destination.selectedSuggestionIdx] || destination.suggestions[0];
						return { lat: sug.lat, lon: sug.lon };
					});

					return $q(function(resolve, reject) {
						map.socket.emit("getRoute", { destinations: points, mode: mode }, function(err, res) {
							err ? reject(err) : resolve(res);
						});
					});
				}).then(function(route) {
					route.routePoints = points;
					route.routeMode = mode;

					scope.routeObj = route;
					renderRoute(dragging);
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

				map.linesUi.createLine(type, scope.routeObj.routePoints, { mode: scope.routeObj.routeMode });

				scope.clear();
			};

			var el = $($templateCache.get("map/search/search-route.html")).insertAfter(map.map.getContainer());
			$compile(el)(scope);
			scope.$evalAsync(); // $compile only replaces variables on next digest

			var routeLayer = null;
			var dragMarker = null;
			var markers = [ ];
			var recalcRoute = fpUtils.minInterval(dragTimeout, false);

			function renderRoute(dragging) {
				clearRoute(dragging);

				routeLayer = L.polyline(scope.routeObj.trackPoints.map(function(it) { return [ it.lat, it.lon ] }), lineStyle).addTo(map.map);
				map.map.almostOver.addLayer(routeLayer);

				dragMarker = fpUtils.temporaryDragMarker(map.map, routeLayer, map.dragMarkerColour, function(marker) {
					var latlng = marker.getLatLng();
					var idx = fpUtils.getIndexOnLine(map.map, scope.routeObj.trackPoints, scope.routeObj.routePoints, { lat: latlng.lat, lon: latlng.lng });

					scope.destinations.splice(idx, 0, makeCoordDestination(latlng));
					markers.splice(idx, 0, marker);

					registerMarkerHandlers(marker);

					marker.once("dragend", updateMarkerColours);

					scope.route(true);
				}.fpWrapApply(scope));

				if(!dragging) {
					map.map.flyToBounds(routeLayer.getBounds());

					// Render markers

					scope.routeObj.routePoints.forEach(function(point, i) {
						var marker = L.marker([ point.lat, point.lon ], {
							icon: fpUtils.createMarkerIcon(map.dragMarkerColour),
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
					}.fpWrapApply(scope));
				});
			}

			function updateMarkerColours() {
				markers.forEach(function(marker, i) {
					var colour = (i == 0 ? map.startMarkerColour : i == markers.length-1 ? map.endMarkerColour : map.dragMarkerColour);

					marker.setIcon(fpUtils.createMarkerIcon(colour));
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
				var disp = fpUtils.round(latlng.lat, 5) + "," + fpUtils.round(latlng.lng, 5);
				return {
					query: disp,
					suggestionQuery: disp,
					selectedSuggestionIdx: 0,
					suggestions: [ {
						lat: latlng.lat,
						lon: latlng.lng,
						display_name: disp,
						short_name: disp,
						type: "coordinates"
					} ]
				};
			}

			var routeUi = {
				show: function() {
					el.show();
				},

				hide: function() {
					clearRoute();
					el.hide();
				},

				route: function(queries, calcRoute) {
					if(queries) {
						for(var i=0; i<queries.length; i++) {
							if(scope.destinations.length <= i)
								scope.addDestination();

							scope.destinations[i].query = queries[i];
						}
					}

					if(calcRoute)
						scope.route();
				}
			};
			routeUi.hide();
			return routeUi;
		};
	});

})(FacilPad, jQuery, angular);