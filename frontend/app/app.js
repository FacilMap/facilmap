var FacilMap = {
	SERVER : "/",
	URL_PREFIX: location.protocol + "//" + location.host + location.pathname.replace(/[^\/]*$/, "")
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
	fm.app.constant("compileExpression", compileExpression);
	fm.app.constant("fmSortableOptions", {
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
	});

	// Properly resolve source maps, see https://github.com/angular/angular.js/issues/5217#issuecomment-257143381
	fm.app.factory('$exceptionHandler', function() {
		return function(exception, cause) {
			console.error(exception.stack || exception);
		};
	});

	fm.app.run(function($rootScope) {
		$rootScope.confirm = function(msg) { return confirm(msg); };
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

})(FacilMap, jQuery, angular);