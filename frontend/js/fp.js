var FacilPad = {
	SERVER : "http://localhost:40829"
};

(function(fp, $, ng, undefined) {

	fp.app = angular.module("facilpad", [ ]).config([ "$compileProvider", function($compileProvider) {
		$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|javascript):/);
	} ]);

	fp.app.run([ "$rootScope", "fpUtils", function($rootScope, fpUtils) {
		$rootScope.padId = location.pathname.match(/[^\/]*$/)[0];
		$rootScope.urlPrefix = location.protocol + "//" + location.host + location.pathname.replace(/[^\/]*$/, "");

		$rootScope.round = fpUtils.round;
		$rootScope.formatTime = fpUtils.formatTime;
		$rootScope.routingMode = fpUtils.routingMode;
	} ]);

	function wrapApply($scope, f) {
		return function() {
			var context = this;
			var args = arguments;
			var func = function() { f.apply(context, args); };

			if($scope.$$phase || $scope.$root.$$phase)
				func();
			else
				$scope.$apply(func);
		}
	}

	Function.prototype.fpWrapApply = function($scope) {
		return wrapApply($scope, this);
	};

	fp.app.controller("PadCtrl", [ "$scope", "fpUi", "fpMap", "$timeout", function($scope, fpUi, fpMap, $timeout) {

		$timeout(function() {
			var map = fpMap.getMap("map");

			if(map.socket.padData)
				$scope.padName = map.socket.padData.name;
			map.socket.$watch("padData.name", function(newVal) {
				$scope.padName = newVal;
			});
		}, 0);

		fpUi.initStyles();
	} ]);

})(FacilPad, jQuery, angular);