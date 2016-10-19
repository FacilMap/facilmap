var FacilMap = {
	SERVER : "/"
};

(function(fm, $, ng, undefined) {

	fm.app = angular.module("facilmap", [ "ui.sortable", "ui.bootstrap" ]).config(function($compileProvider, $uibTooltipProvider) {
		$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|javascript):/);

		$uibTooltipProvider.options({
			placement: "bottom"
		});
	});

	fm.app.constant("L", L);
	fm.app.constant("linkifyStr", linkifyStr);
	fm.app.constant("Clipboard", Clipboard);

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

	fm.app.run(function($rootScope, fmUtils) {
		$rootScope.urlPrefix = location.protocol + "//" + location.host + location.pathname.replace(/[^\/]*$/, "");

		$rootScope.round = fmUtils.round;
		$rootScope.formatTime = fmUtils.formatTime;
		$rootScope.routingMode = fmUtils.routingMode;

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
	});

	function wrapApply($scope, f) {
		return function() {
			var context = this;
			var args = arguments;
			var func = function() { return f.apply(context, args); };

			if($scope.$$phase || $scope.$root.$$phase)
				return func();
			else
				return $scope.$apply(func);
		}
	}

	Function.prototype.fmWrapApply = function($scope) {
		return wrapApply($scope, this);
	};

	fm.app.controller("PadCtrl", function($scope, fmMap, $timeout) {
		$scope.padId = decodeURIComponent(location.pathname.match(/[^\/]*$/)[0]);

		$timeout(function() {
			var map = fmMap.getMap("map");

			map.socket.$watch("padData.name", function(newVal) {
				$scope.padName = newVal;
			});

			map.socket.$watch("padId", function(padId) {
				if(padId)
					history.replaceState(null, "", $scope.urlPrefix + padId + location.hash);
			});
		}, 0);

	});

})(FacilMap, jQuery, angular);