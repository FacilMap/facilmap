(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapAbout", function($uibModal) {
		return function(map) {
			return {
				showAbout : function() {
					$uibModal.open({
						templateUrl: "map/about/about.html",
						scope: map.socket,
						controller: "fpMapAboutCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; }
						}
					});
				}
			};
		};
	});

	fp.app.controller("fpMapAboutCtrl", function($scope, map) {
		$scope.layers = map.getLayerInfo();
	});

})(FacilPad, jQuery, angular);