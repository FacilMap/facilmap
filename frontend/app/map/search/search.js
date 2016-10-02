(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapSearch", function($rootScope, $templateCache, $compile, fpUtils) {
		var namefinder = new FacilMap.NameFinder.Nominatim();

		return function(map) {
			var scope = $rootScope.$new(true);
			scope.searchString = "";
			scope.searchResults = null;

			scope.search = function() {
				scope.searchResults = null;
				if(scope.searchString.trim() != "") {
					map.loadStart();
					namefinder.find(scope.searchString, function(results) {
						map.loadEnd();
						scope.searchResults = results;

						if(results.length > 0)
							scope.showResult(results[0]);
					}.fpWrapApply(scope));
				}
			};

			scope.showResult = function(result) {
				map.map.moveTo(result.lonlat.clone().transform(fpUtils.proj(), map.map.getProjectionObject()), result.getZoom(map.map));
			};

			var el = $($templateCache.get("map/search/search.html")).appendTo(map.map.div);
			$compile(el)(scope);
			scope.$evalAsync(); // $compile only replaces variables on next digest
		};
	});

})(FacilPad, jQuery, angular);