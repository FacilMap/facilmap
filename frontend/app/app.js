var FacilPad = {
	SERVER : "http://localhost:40829"
};

(function(fp, $, ng, undefined) {

	fp.app = angular.module("facilpad", [ "ui.sortable", "ui.bootstrap" ]).config([ "$compileProvider", function($compileProvider) {
		$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|javascript):/);
	} ]);

	// Dereferrer
	$(document).on("click", "a", function(e) {
		var el = $(e.target);
		var href = el.attr("href");
		if(href && href.match(/^\s*(https?:)?\/\//i)) {
			el.attr("href", "deref.html?"+encodeURIComponent(href));

			setTimeout(function() {
				el.attr("href", href);
			}, 0);
		}
	});

	fp.app.run([ "$rootScope", "fpUtils", function($rootScope, fpUtils) {
		$rootScope.padId = location.pathname.match(/[^\/]*$/)[0];
		$rootScope.urlPrefix = location.protocol + "//" + location.host + location.pathname.replace(/[^\/]*$/, "");

		$rootScope.round = fpUtils.round;
		$rootScope.formatTime = fpUtils.formatTime;
		$rootScope.routingMode = fpUtils.routingMode;

		$rootScope.sortableOptions = {
			handle: ".sort-handle",
			axis: "y",
			cursor: "move",
			helper: function(e, ui) { // Source: http://www.foliotek.com/devblog/make-table-rows-sortable-using-jquery-ui-sortable/
				ui.children().each(function() {
					$(this).width($(this).width());
				});
				return ui;
			},
			start: function(e, ui) {
				var elChildren = ui.item.children();
				ui.placeholder.children().each(function(i) {
					$(this).width(elChildren.eq(i).width());
					$(this).height(elChildren.eq(i).height());
				});
			},
			stop: function(e, ui) {
				ui.item.children().each(function() {
					$(this).css("width", "");
				});
			}
		};
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

	} ]);

})(FacilPad, jQuery, angular);