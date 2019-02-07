import $ from 'jquery';
import ng from 'angular';
import 'bootstrap';
import 'angular-ui-bootstrap';
import 'angular-ui-sortable';
import 'babel-polyfill';

const fm = {
	URL_PREFIX: location.protocol + "//" + location.host + location.pathname.replace(/[^\/]*$/, "")
};

fm.app = ng.module("facilmap", [ "ui.sortable", "ui.bootstrap" ]);

fm.app.config(function($compileProvider, $uibTooltipProvider) {
	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|javascript):/);

	$uibTooltipProvider.options({
		placement: "bottom"
	});
});

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

fm.app.constant("fmConfig", JSON.parse($("meta[name=fmConfig]").attr("content")));

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

export default fm;