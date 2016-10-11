(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapSearch", function($rootScope, $templateCache, $compile, fpUtils, L, $timeout) {
		return function(map) {
			var iconSuffix = ".n.32.png";

			var scope = $rootScope.$new(true);
			scope.searchString = "";
			scope.searchResults = null;
			scope.showAll = false;
			scope.activeResult = null;

			scope.search = function() {
				scope.searchResults = null;
				clearRenders();

				if(scope.searchString.trim() != "") {
					map.loadStart();
					map.socket.emit("find", { query: scope.searchString }, function(err, results) {
						map.loadEnd();

						if(err)
							map.messages.showMessage("danger", err);

						scope.searchResults = results;

						if(results && results.length > 0)
							scope.showAll ? scope.showAllResults() : scope.showResult(results[0]);
					});
				}
			};

			scope.showResult = function(result) {
				if(scope.showAll) {
					map.map.flyToBounds(layerGroup.getBounds());
					result.marker.openPopup();
				} else {
					clearRenders();
					renderResult(result, true);

					if(result.boundingbox)
						map.map.flyToBounds([ [ result.boundingbox[0], result.boundingbox[3 ] ], [ result.boundingbox[1], result.boundingbox[2] ] ]);
					else
						map.map.flyTo([ result.lat, result.lon ], result.zoom);
				}
			};

			scope.showAllResults = function() {
				clearRenders();

				for(var i=0; i<scope.searchResults.length; i++)
					renderResult(scope.searchResults[i], false);

				map.map.flyToBounds(layerGroup.getBounds());
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

			var layerGroup = L.featureGroup([]).addTo(map.map);

			function renderResult(result, showPopup) {
				layerGroup.addLayer(
					L.geoJson(result.geojson, {
						pointToLayer: function(geoJsonPoint, latlng) {
							return null;
						}
					})
					.bindPopup($("<div/>")[0], map.popupOptions)
					.on("popupopen", function(e) {
						scope.activeResult = result;
						renderResultPopup(result, e.popup);
					})
					.on("popupclose", function(e) {
						scope.activeResult = null;
						ng.element(e.popup.getContent()).scope().$destroy();
					})
					.bindTooltip(result.display_name, $.extend({}, map.tooltipOptions, { sticky: true, offset: [ 20, 0 ] }))
				);

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
						renderResultPopup(result, e.popup);
					})
					.on("popupclose", function(e) {
						scope.activeResult = null;
						ng.element(e.popup.getContent()).scope().$destroy();
					})
					.bindTooltip(result.display_name, $.extend({}, map.tooltipOptions, { offset: [ 20, 0 ] }));

				layerGroup.addLayer(result.marker);

				if(showPopup)
					result.marker.openPopup();
			}

			function clearRenders() {
				layerGroup.clearLayers();
			}

			function renderResultPopup(result, popup) {
				var scope = map.socket.$new();

				scope.result = result;

				scope.addToMap = function(type) {
					if(type == null) {
						for(var i in map.socket.types) {
							if(map.socket.types[i].type == "marker") {
								type = map.socket.types[i];
								break;
							}
						}
					}

					map.markersUi.createMarker(result, type, { name: result.display_name });
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

			var fpMapSearch = {
				search: function(query) {
					if(query != null)
						scope.searchString = query;

					scope.search();
				},

				showFiles: function(files) {
					console.log("showFiles", files);
				}
			};
			return fpMapSearch;
		};
	});

})(FacilPad, jQuery, angular);