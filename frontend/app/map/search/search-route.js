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

				var dest;

				return $q.all(scope.destinations.map(scope.loadSuggestions)).then(function() {
					dest = ng.copy(scope.destinations);

					var points = dest.map(function(destination) {
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
					scope.loadedDestinations = dest;
					renderRoutes(dragging);

					if(!dragging)
						renderMarkers();
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
				scope.loadedDestinations = null;

				clearRoutes();
				clearMarkers();
			};

			scope.setActiveRoute = function(routeIdx) {
				scope.activeRouteIdx = routeIdx;
				updateActiveRoute();
			};

			var el = $($templateCache.get("map/search/search-route.html")).insertAfter(map.map.getContainer());
			$compile(el)(scope);
			scope.$evalAsync(); // $compile only replaces variables on next digest

			var layerGroup = L.featureGroup([]).addTo(map.map);
			var markerGroup = L.featureGroup([]).addTo(map.map);

			function renderRoutes(dragging) {
				clearRoutes();

				scope.routes.forEach(function(route, i) {
					var layer = L.polyline(route.trackPoints.map(function(it) { return [ it.lat, it.lon ] }), i == scope.activeRouteIdx ? activeStyle : inactiveStyle)
						.on("click", function() {
							scope.setActiveRoute(i);
						})
						.bindTooltip(route.display_name, $.extend({}, map.tooltipOptions, { sticky: true, offset: [ 20, 0 ] }));

					layerGroup.addLayer(layer);
				});

				updateActiveRoute();

				if(!dragging)
					map.map.flyToBounds(layerGroup.getBounds());
			}

			function renderMarkers() {
				clearMarkers();

				scope.loadedDestinations.forEach(function(destination, i) {
					var colour = (i == 0 ? map.startMarkerColour : i == scope.loadedDestinations.length-1 ? map.endMarkerColour : map.dragMarkerColour);

					var recalcRoute = fpUtils.minInterval(dragTimeout, false, function() {
						var latlng = marker.getLatLng();

						var disp = fpUtils.round(latlng.lat, 5) + "," + fpUtils.round(latlng.lng, 5);
						scope.destinations[i] = {
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

						return scope.route(true);
					}.fpWrapApply(scope));

					var sugg = destination.suggestions[destination.selectedSuggestionIdx] || destination.suggestions[0];
					var marker = L.marker([ sugg.lat, sugg.lon ], {
						icon: fpUtils.createMarkerIcon(colour),
						draggable: true
					})
						.on("dblclick", function() {
							scope.$apply(function() {
								scope.removeDestination(i);
							});
						})
						.on("drag", recalcRoute);

					markerGroup.addLayer(marker);
				});
			}

			function updateActiveRoute() {
				layerGroup.getLayers().forEach(function(layer, i) {
					layer.setStyle(i == scope.activeRouteIdx ? activeStyle : inactiveStyle);
				});
			}

			function clearRoutes() {
				layerGroup.clearLayers();
			}

			function clearMarkers() {
				markerGroup.clearLayers();
			}

			var routeUi = {
				show: function() {
					el.show();
				},

				hide: function() {
					clearRoutes();
					clearMarkers();
					el.hide();
				}
			};
			routeUi.hide();
			return routeUi;
		};
	});

})(FacilPad, jQuery, angular);