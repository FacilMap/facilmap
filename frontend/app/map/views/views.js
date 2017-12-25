import fm from '../../app';

fm.app.factory("fmMapViews", function($uibModal) {
	return function(map) {
		var ret = {
			saveView : function() {
				$uibModal.open({
					template: require("./save-view.html"),
					controller: "fmMapViewsSaveCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; }
					}
				});
			},
			manageViews : function() {
				$uibModal.open({
					template: require("./manage-views.html"),
					controller: "fmMapViewsManageCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; }
					}
				});
			}
		};

		return ret;
	};
});

fm.app.controller("fmMapViewsSaveCtrl", function($scope, map) {
	$scope.name = null;
	$scope.filter = map.client.filterExpr;

	$scope.save = function() {
		$scope.saving = true;

		var view = map.getCurrentView($scope.saveFilter);
		view.name = $scope.name;
		map.client.addView(view).then(function(view) {
			if($scope.makeDefault)
				return map.client.editPad({ defaultViewId: view.id });
		}).then(function() {
			$scope.$close();
		}).catch(function(err) {
			$scope.error = err;
			$scope.saving = false;
		});
	};
});

fm.app.controller("fmMapViewsManageCtrl", function($scope, map) {
	$scope.client = map.client;
	$scope.saving = {};

	$scope.display = function(view) {
		map.displayView(view);
	};

	$scope.makeDefault = function(view) {
		$scope.saving[view.id] = true;
		map.client.editPad({ defaultViewId: view.id }).then(() => {
			$scope.saving[view.id] = false;
		}).catch(function(err) {
			$scope.error = err;
			$scope.saving[view.id] = false;
		});
	};

	$scope['delete'] = function(view) {
		$scope.saving[view.id] = true;
		map.client.deleteView({ id: view.id }).catch(function(err) {
			$scope.error = err;
			$scope.saving[view.id] = false;
		});
	};
});
