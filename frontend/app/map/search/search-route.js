(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapSearchRoute", function($rootScope, $templateCache, $compile, fpUtils, L, $timeout, $q) {
		return function(map, searchUi) {
			var activeStyle = {
				color : '#0000ff',
				weight : 8,
				opacity : 0.7
			};

			var inactiveStyle = {
				color : '#0000ff',
				weight : 6,
				opacity : 0.3
			};

			var dragTimeout = 300;

			var scope = $rootScope.$new(true);

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

				return $q.all(scope.destinations.map(scope.loadSuggestions)).then(function() {
					points = scope.destinations.map(function(destination) {
						if(destination.suggestions.length == null)
							throw "No place has been found for search term “" + destination.query + "”.";

						var sug = destination.suggestions[destination.selectedSuggestionIdx] || destination.suggestions[0];
						return { lat: sug.lat, lon: sug.lon };
					});

					return $q(function(resolve, reject) {
						map.socket.emit("getRoutes", { destinations: points, mode: scope.routeMode }, function(err, res) {
							err ? reject(err) : resolve(res);
						});
					});
				}).then(function(routes) {
					routes.forEach(function(route, i) {
						route.short_name = "Option " + (i+1);
						route.display_name = route.short_name + " (" + fpUtils.round(route.distance, 2) + " km, " + fpUtils.formatTime(route.time) + " h)";
						route.routeMode = scope.routeMode;
					});

					scope.routes = routes;
					scope.activeRouteIdx = 0;
					scope.currentRoutePoints = points;
					renderRoutes(dragging);
				}).catch(function(err) {
					scope.routeError = err;
				});
			};

			scope.reroute = function() {
				if(scope.routes || scope.routeError)
					scope.route();
			};

			scope.reset = function() {
				scope.routes = [ ];
				scope.routeError = null;
				scope.activeRouteIdx = null;
				scope.currentRoutePoints = null;

				clearRoutes();
			};

			scope.setActiveRoute = function(routeIdx) {
				scope.activeRouteIdx = routeIdx;
				updateActiveRoute();
			};

			var el = $($templateCache.get("map/search/search-route.html")).insertAfter(map.map.getContainer());
			$compile(el)(scope);
			scope.$evalAsync(); // $compile only replaces variables on next digest

			var layerGroup = L.featureGroup([]).addTo(map.map);
			var markers = [ ];
			var recalcRoute = fpUtils.minInterval(dragTimeout, false);

			function renderRoutes(dragging) {
				clearRoutes(dragging);

				scope.routes.forEach(function(route, i) {
					var layer = L.polyline(route.trackPoints.map(function(it) { return [ it.lat, it.lon ] }), i == scope.activeRouteIdx ? activeStyle : inactiveStyle)
						.on("click", function() {
							scope.setActiveRoute(i);
						})
						.bindTooltip(route.display_name, $.extend({}, map.tooltipOptions, { sticky: true, offset: [ 20, 0 ] }));

					layerGroup.addLayer(layer);
					map.map.almostOver.addLayer(layer);
				});

				updateActiveRoute();

				if(!dragging) {
					map.map.flyToBounds(layerGroup.getBounds());

					// Render markers

					scope.currentRoutePoints.forEach(function(point, i) {
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

			function updateActiveRoute() {
				layerGroup.getLayers().forEach(function(layer, i) {
					var active = (i == scope.activeRouteIdx);

					layer.setStyle(active ? activeStyle : inactiveStyle);

					if(active && !layer._fpDragMarker) {
						layer._fpDragMarker = fpUtils.temporaryDragMarker(map.map, layer, map.dragMarkerColour, function(marker) {
							var latlng = marker.getLatLng();
							var idx = fpUtils.getIndexOnLine(map.map, scope.routes[i].trackPoints, scope.currentRoutePoints, { lat: latlng.lat, lon: latlng.lng });

							scope.destinations.splice(idx, 0, makeCoordDestination(latlng));
							markers.splice(idx, 0, marker);

							registerMarkerHandlers(marker);

							marker.once("dragend", updateMarkerColours);

							scope.route(true);
						}.fpWrapApply(scope));
					} else if(!active && layer._fpDragMarker) {
						layer._fpDragMarker();
						delete layer._fpDragMarker;
					}
				});
			}

			function clearRoutes(dragging) {
				layerGroup.eachLayer(function(it) {
					map.map.almostOver.removeLayer(it);
				});
				layerGroup.clearLayers();

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
					clearRoutes();
					el.hide();
				}
			};
			routeUi.hide();
			return routeUi;
		};
	});

})(FacilPad, jQuery, angular);