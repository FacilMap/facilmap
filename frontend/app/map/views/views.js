(function(fm, $, ng, undefined) {

	fm.app.factory("fmMapViews", function($uibModal) {
		return function(map) {
			var ret = {
				saveView : function() {
					$uibModal.open({
						templateUrl: "map/views/save-view.html",
						scope: map.socket,
						controller: "fmMapViewsSaveCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; }
						}
					});
				},
				manageViews : function() {
					$uibModal.open({
						templateUrl: "map/views/manage-views.html",
						scope: map.socket,
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

		$scope.save = function(makeDefault) {
			var view = map.getCurrentView();
			view.name = $scope.name;
			map.socket.emit("addView", view).then(function(view) {
				if(makeDefault)
					return map.socket.emit("editPad", { defaultViewId: view.id });
			}).then(function() {
				$scope.$close();
			}).catch(function(err) {
				$scope.error = err;
			});
		};
	});

	fm.app.controller("fmMapViewsManageCtrl", function($scope, map) {
		$scope.display = function(view) {
			map.displayView(view);
		};

		$scope.makeDefault = function(view) {
			map.socket.emit("editPad", { defaultViewId: view.id }).catch(function(err) {
				$scope.error = err;
			});
		};

		$scope['delete'] = function(view) {
			map.socket.emit("deleteView", { id: view.id }).catch(function(err) {
				$scope.error = err;
			});
		};
	});

})(FacilMap, jQuery, angular);