import fm from '../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';

fm.app.factory("fmSearchRoute", function($rootScope, $compile, fmUtils, $timeout, $q, fmSortableOptions) {
	return function(map, searchUi) {
		var scope = $rootScope.$new(true);

		scope.client = map.client;
		scope.routeMode = 'car';
		scope.destinations = [ ];
		scope.submittedQueries = null;
		scope.submittedMode = null;

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
				suggestions: [ ]
			});
		};

		scope.addDestination();
		scope.addDestination();

		scope.removeDestination = function(idx) {
			scope.destinations.splice(idx, 1);
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
				return map.client.find({ query: query }).then(function(results) {
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

		scope.route = function(noZoom) {
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

			map.mapEvents.$broadcast("searchchange");

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

				map.mapEvents.$broadcast("searchchange");

				return map.routeUi.setRoute(points.map(function(point) { return { lat: point.lat, lon: point.lon }; }), mode).then(() => {
					if(!noZoom)
						map.routeUi.zoom();
				});
			}).catch((err) => {
				map.messages.showMessage("danger", err);
			});
		};

		scope.reroute = function(noZoom) {
			if(scope.hasRoute())
				scope.route(noZoom);
		};

		scope.reset = function() {
			scope.submittedQueries = null;
			scope.submittedMode = null;

			map.routeUi.clearRoute();
		};

		scope.clear = function() {
			scope.reset();

			scope.destinations = [ ];
			scope.addDestination();
			scope.addDestination();
		};

		map.mapEvents.$on("routeDestinationAdd", (e, idx) => {
			scope.destinations.splice(idx, 0, makeCoordDestination(map.client.route.routePoints[idx]));
			if(scope.submittedQueries)
				scope.submittedQueries.splice(idx, 0, makeCoordDestination(map.client.route.routePoints[idx]).query);
			map.mapEvents.$broadcast("searchchange");
		});

		map.mapEvents.$on("routeDestinationMove", (e, idx) => {
			scope.destinations[idx] = makeCoordDestination(map.client.route.routePoints[idx]);
			if(scope.submittedQueries)
				scope.submittedQueries[idx] = makeCoordDestination(map.client.route.routePoints[idx]).query;
			map.mapEvents.$broadcast("searchchange");
		});

		map.mapEvents.$on("routeDestinationRemove", (e, idx) => {
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

		var el = $(require("./search-route.html")).insertAfter(searchUi._el);
		$compile(el)(scope);
		scope.$evalAsync(); // $compile only replaces variables on next digest

		function makeCoordDestination(lonlat) {
			var disp = fmUtils.round(lonlat.lat, 5) + "," + fmUtils.round(lonlat.lon, 5);
			return {
				query: disp,
				loadingQuery: disp,
				loadedQuery: disp,
				selectedSuggestionIdx: 0,
				suggestions: [ {
					lat: lonlat.lat,
					lon: lonlat.lon,
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

			getTypedQueries: function() {
				return scope.destinations.map((destination) => (destination.query));
			},

			getMode: function() {
				return scope.submittedMode;
			},

			submit: function(noZoom) {
				scope.route(noZoom);
			},

			destroy: function() {
				scope.reset();
				el.remove();
				scope.$destroy();
			}
		};
		routeUi.hide();
		return routeUi;
	};
});
