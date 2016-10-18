(function(fm, $, ng, undefined) {

	fm.app.factory("fmMapAbout", function($uibModal) {
		return function(map) {
			return {
				showAbout : function() {
					$uibModal.open({
						templateUrl: "map/about/about.html",
						scope: map.socket,
						controller: "fmMapAboutCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; }
						}
					});
				}
			};
		};
	});

	fm.app.controller("fmMapAboutCtrl", function($scope, map) {
		$scope.layers = map.getLayerInfo();
	});

})(FacilMap, jQuery, angular);