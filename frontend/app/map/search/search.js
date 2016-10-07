(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapSearch", function($rootScope, $templateCache, $compile, fpUtils, fpNameFinder) {
		return function(map) {
			var scope = $rootScope.$new(true);
			scope.searchString = "";
			scope.searchResults = null;

			scope.search = function() {
				scope.searchResults = null;
				if(scope.searchString.trim() != "") {
					map.loadStart();
					fpNameFinder.find(scope.searchString).then(function(results) {
						map.loadEnd();
						scope.searchResults = results;

						if(results.length > 0)
							scope.showResult(results[0]);
					});
				}
			};

			scope.showResult = function(result) {
				if(result.boundingbox)
					map.map.flyToBounds([ [ result.boundingbox[0], result.boundingbox[3 ] ], [ result.boundingbox[1], result.boundingbox[2] ] ]);
				else
					map.map.flyTo([ result.lat, result.lon ], result.zoom);
			};

			var el = $($templateCache.get("map/search/search.html")).insertAfter(map.map.getContainer());
			$compile(el)(scope);
			scope.$evalAsync(); // $compile only replaces variables on next digest
		};
	});

})(FacilPad, jQuery, angular);