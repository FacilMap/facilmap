import fm from '../app';
import $ from 'jquery';
import * as commonFilter from '../../common/filter';

fm.app.factory("fmFilter", function($rootScope, $uibModal, fmUtils) {
	var currentVal;

	var fmFilter = $.extend({}, commonFilter, {
		showFilterDialog: function(currentFilter, types) {
			var dialog = $uibModal.open({
				template: require("./filter-dialog.html"),
				scope: $rootScope,
				controller: "fmFilterDialogCtrl",
				size: "lg",
				resolve: {
					currentFilter: function() { return currentFilter; },
					types: function() { return types; }
				}
			});

			return dialog.result;
		}
	});

	return fmFilter;
});

fm.app.controller("fmFilterDialogCtrl", function(currentFilter, types, $scope, fmFilter) {
	$scope.filter = currentFilter;
	$scope.types = types;

	$scope.$watch("filter", function(newFilter) {
		$scope.error = fmFilter.hasError(newFilter);
	})
});
