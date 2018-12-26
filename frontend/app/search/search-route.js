import fm from '../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import css from './search-route.scss';

fm.app.directive("fmSearchRoute", function($rootScope, $compile, fmUtils, $timeout, $q, fmSortableOptions, fmHighlightableLayers) {
	return {
		require: "^fmSearch",
		scope: true,
		replace: true,
		template: require("./search-route.html"),
		link(scope, el, attrs, searchUi) {
			const map = searchUi.map;

			scope.client = map.client;
			scope.className = css.className;
			scope.routeMode = 'car';
			scope.destinations = [ ];
			scope.submittedQueries = null;
			scope.submittedMode = null;
			scope.errors = [ ];

			scope.sortableOptions = ng.copy(fmSortableOptions);
			scope.sortableOptions.update = function() {
				scope.reroute(true);
			};

			scope.hasRoute = function() {
				return map.routeUi.hasRoute();
			};

			scope.addDestination = function() {
				scope.destinations.push({
					query: "",
					loadingQuery: "",
					loadedQuery: "",
					searchSuggestions: [ ]
				});
			};

			scope.addDestination();
			scope.addDestination();

			scope.removeDestination = function(idx) {
				scope.destinations.splice(idx, 1);
			};

			scope.showSearchForm = function() {
				map.searchUi.showQuery();
			};

			scope.getSelectedSuggestion = function(destination) {
				if(destination.selectedSuggestion && ((destination.searchSuggestions || []).indexOf(destination.selectedSuggestion) != -1 || (destination.mapSuggestions || []).indexOf(destination.selectedSuggestion) != -1))
					return destination.selectedSuggestion;
				else if(destination.mapSuggestions && destination.mapSuggestions.length > 0 && (destination.mapSuggestions[0].similarity == 1 || destination.searchSuggestions.length == 0))
					return destination.mapSuggestions[0];
				else if(destination.searchSuggestions.length > 0)
					return destination.searchSuggestions[0];
				else
					return null;
			};

			scope.loadSuggestions = function(destination) {
				if(destination.loadedQuery == destination.query)
					return $q.resolve();

				destination.searchSuggestions = [ ];
				destination.mapSuggestions = [ ];
				var query = destination.loadingQuery = destination.query;

				if(destination.query.trim() != "") {
					return $q.all([
						map.client.find({ query: query }),
						$q.resolve().then(() => {
							if(map.client.padId) {
								let m = query.match(/^m(\d+)$/);
								if(m)
									return map.client.getMarker({ id: m[1] }).then((marker) => (marker ? [ Object.assign({ kind: "marker" }, marker) ] : [ ]));
								else
									return map.client.findOnMap({ query });
							}
						})
					]).then(function([ searchResults, mapResults ]) {
						if(query != destination.loadingQuery)
							return; // The destination has changed in the meantime

						destination.selectedSuggestion = null;

						if(fmUtils.isSearchId(query) && searchResults.length > 0 && searchResults[0].display_name) {
							destination.query = query = searchResults[0].display_name;
							destination.selectedSuggestion = searchResults[0];
						}

						destination.searchSuggestions = searchResults;

						if(mapResults) {
							mapResults = mapResults.filter((suggestion) => (suggestion.kind == "marker"));

							let referencedMapResult = null;
							for(let result of mapResults) {
								result.hashId = "m" + result.id;
								if(referencedMapResult == null && result.hashId == query)
									referencedMapResult = result;
							}

							destination.mapSuggestions = mapResults;

							if(referencedMapResult) {
								destination.query = query = referencedMapResult.name;
								destination.selectedSuggestion = referencedMapResult;
							}
						}

						if(destination.selectedSuggestion == null)
							destination.selectedSuggestion = scope.getSelectedSuggestion(destination);

						destination.loadedQuery = query;
					}).catch(function(err) {
						if(query != destination.loadingQuery)
							return; // The destination has changed in the meantime

						console.warn(err.stack || err);
						scope.errors.push(err);
					});
				}
			};

			let suggestionMarker = null;

			scope.suggestionMouseOver = function(suggestion) {
				suggestionMarker = (new fmHighlightableLayers.Marker([ suggestion.lat, suggestion.lon ], {
					highlight: true,
					colour: map.dragMarkerColour,
					size: 35,
					symbol: suggestion.icon || suggestion.symbol
				})).addTo(map.map);
			};

			scope.suggestionMouseOut = function(suggestion) {
				if(suggestionMarker) {
					suggestionMarker.remove();
					suggestionMarker = null;
				}
			};

			scope.suggestionZoom = function(suggestion) {
				map.map.flyTo([ suggestion.lat, suggestion.lon ]);
			};


			scope.highlightedIdx = null;
			let highlightedMarker = null;

			scope.destinationMouseOver = function(idx) {
				let destination = scope.destinations[idx];
				if(!destination)
					return;

				let suggestion = scope.getSelectedSuggestion(destination);

				if(destination.query == destination.loadedQuery && suggestion) {
					let marker = map.routeUi.getMarker(idx);
					if(marker && marker.getLatLng().equals([ suggestion.lat, suggestion.lon ])) {
						highlightedMarker = marker;
						scope.highlightedIdx = idx;
						marker.setStyle({ highlight: true });
					}
				}
			};

			scope.destinationMouseOut = function(idx) {
				if(highlightedMarker) {
					highlightedMarker.setStyle({ highlight: false });
					scope.highlightedIdx = null;
					highlightedMarker = null;
				}
			};

			map.mapEvents.$on("routeDestinationMouseOver", (e, [ idx ]) => {
				scope.destinationMouseOver(idx);
			});

			map.mapEvents.$on("routeDestinationMouseOut", (e, [ idx ]) => {
				scope.destinationMouseOut(idx);
			});



			scope.route = function(noZoom) {
				scope.reset();

				if(scope.destinations[0].query.trim() == "" || scope.destinations[scope.destinations.length-1].query.trim() == "")
					return;

				var points;
				var mode = scope.routeMode;

				scope.submittedQueries = scope.destinations.map(function(destination) {
					if(destination.loadedQuery == destination.query && (destination.searchSuggestions.length || destination.mapSuggestions.length))
						return scope.getSelectedSuggestion(destination).hashId || scope.getSelectedSuggestion(destination).id;
					else
						return destination.query;
				});
				scope.submittedMode = mode;

				map.mapEvents.$broadcast("searchchange");

				return $q.all(scope.destinations.map(scope.loadSuggestions)).then(function() {
					points = scope.destinations.filter(function(destination) {
						return destination.query.trim() != "";
					}).map(function(destination) {
						return scope.getSelectedSuggestion(destination);
					});

					if(points.includes(null))
						throw new Error("Some destinations could not be found.");

					scope.submittedQueries = points.map(function(point) {
						return point.hashId || point.id;
					});

					map.mapEvents.$broadcast("searchchange");

					return map.routeUi.setRoute(points.map(function(point) { return { lat: point.lat, lon: point.lon }; }), mode, !noZoom);
				}).catch((err) => {
					console.warn(err.stack || err);
					scope.errors.push(err);
				});
			};

			scope.reroute = function(noZoom) {
				if(scope.hasRoute())
					scope.route(noZoom);
			};

			scope.reset = function() {
				scope.submittedQueries = null;
				scope.submittedMode = null;
				scope.errors = [];

				if(suggestionMarker) {
					suggestionMarker.remove();
					suggestionMarker = null;
				}

				map.routeUi.clearRoute();
			};

			scope.clear = function() {
				scope.reset();

				scope.destinations = [ ];
				scope.addDestination();
				scope.addDestination();
			};

			scope.$watch("routeMode", (routeMode) => {
				scope.reroute(true);
			});

			map.mapEvents.$on("routeDestinationAdd", (e, [ idx, point ]) => {
				scope.destinations.splice(idx, 0, makeCoordDestination(point));
				if(scope.submittedQueries)
					scope.submittedQueries.splice(idx, 0, makeCoordDestination(point).query);
				map.mapEvents.$broadcast("searchchange");
			});

			map.mapEvents.$on("routeDestinationMove", (e, [ idx, point ]) => {
				scope.destinations[idx] = makeCoordDestination(point);
				if(scope.submittedQueries)
					scope.submittedQueries[idx] = makeCoordDestination(point).query;
				map.mapEvents.$broadcast("searchchange");
			});

			map.mapEvents.$on("routeDestinationRemove", (e, [ idx ]) => {
				scope.destinations.splice(idx, 1);
				if(scope.submittedQueries)
					scope.submittedQueries.splice(idx, 1);
				map.mapEvents.$broadcast("searchchange");
			});

			map.mapEvents.$on("routeClear", () => {
				scope.submittedQueries = null;
				scope.submittedMode = null;
				map.mapEvents.$broadcast("searchchange");
			});

			function makeCoordDestination(lonlat) {
				var disp = fmUtils.round(lonlat.lat, 5) + "," + fmUtils.round(lonlat.lon, 5);
				let suggestion = {
					lat: lonlat.lat,
					lon: lonlat.lon,
					display_name: disp,
					short_name: disp,
					type: "coordinates",
					id: disp
				};
				return {
					query: disp,
					loadingQuery: disp,
					loadedQuery: disp,
					selectedSuggestion: suggestion,
					searchSuggestions: [ suggestion ]
				};
			}

			function _setDestination(dest, query, searchSuggestions, mapSuggestions, selectedSuggestion) {
				dest.query = query;

				if(searchSuggestions) {
					dest.searchSuggestions = searchSuggestions;
					dest.mapSuggestions = mapSuggestions && mapSuggestions.filter((suggestion) => (suggestion.kind == "marker"));
					dest.loadingQuery = dest.loadedQuery = query;
					dest.selectedSuggestion = selectedSuggestion;
				}
			}

			var routeUi = searchUi.routeUi = {
				show: function() {
					el.show();
				},

				hide: function() {
					scope.reset();
					el.hide();
				},

				setQueries: function(queries) {
					scope.submittedQueries = null;
					scope.submittedMode = null;
					scope.destinations = [ ];

					for(var i=0; i<queries.length; i++) {
						if(scope.destinations.length <= i)
							scope.addDestination();

						$.extend(scope.destinations[i], typeof queries[i] == "object" ? queries[i] : { query: queries[i] });
					}

					while(scope.destinations.length < 2)
						scope.addDestination();
				},

				setFrom: function(from, searchSuggestions, mapSuggestions, selectedSuggestion) {
					_setDestination(scope.destinations[0], from, searchSuggestions, mapSuggestions, selectedSuggestion);
				},

				addVia: function(via, searchSuggestions, mapSuggestions, selectedSuggestion) {
					scope.addDestination();
					var newDest = scope.destinations.pop();
					_setDestination(newDest, via, searchSuggestions, mapSuggestions, selectedSuggestion);
					scope.destinations.splice(scope.destinations.length-1, 0, newDest);
				},

				setTo: function(to, searchSuggestions, mapSuggestions, selectedSuggestion) {
					_setDestination(scope.destinations[scope.destinations.length-1], to, searchSuggestions, mapSuggestions, selectedSuggestion);
				},

				setMode: function(mode) {
					scope.routeMode = mode;
				},

				getQueries: function() {
					return scope.submittedQueries;
				},

				getTypedQueries: function() {
					return scope.destinations.map((destination) => (destination.query));
				},

				getMode: function() {
					return scope.submittedMode;
				},

				submit: function(noZoom) {
					scope.route(noZoom);
				},

				getSubmittedSearch() {
					var queries = routeUi.getQueries();
					if(queries)
						return queries.join(" to ") + " by " + routeUi.getMode();
				},

				isZoomedToSubmittedSearch() {
					let zoomDestination = map.routeUi.getZoomDestination();
					if(zoomDestination)
						return map.map.getZoom() == zoomDestination[1] && fmUtils.pointsEqual(map.map.getCenter(), zoomDestination[0], map.map);
				},

				hasResults() {
					return map.routeUi.routes.length > 0
				}
			};

			scope.$on("$destroy", () => {
				scope.reset();
				el.remove();
				searchUi.routeUi = null;
			})
		}
	};
});
