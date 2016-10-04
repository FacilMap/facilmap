(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapViews", function($uibModal) {
		return function(map) {
			var ret = {
				saveView : function() {
					$uibModal.open({
						templateUrl: "map/views/save-view.html",
						scope: map.socket,
						controller: "fpMapViewsSaveCtrl",
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
						controller: "fpMapViewsManageCtrl",
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

	fp.app.controller("fpMapViewsSaveCtrl", function($scope, map) {
		$scope.name = null;

		$scope.save = function(makeDefault) {
			var view = map.getCurrentView();
			view.name = $scope.name;
			map.socket.emit("addView", view, function(err, view) {
				if(err)
					return $scope.error = err;

				if(makeDefault) {
					map.socket.emit("editPad", { defaultViewId: view.id }, function(err) {
						if(err)
							return $scope.error = err;

						$scope.$close();
					});
				}
				else
					$scope.$close();
			});
		};
	});

	fp.app.controller("fpMapViewsManageCtrl", function($scope, map) {
		$scope.display = function(view) {

		};

		$scope.makeDefault = function(view) {
			map.socket.emit("editPad", { defaultViewId: view.id }, function(err) {
				if(err)
					$scope.error = err;
			});
		};

		$scope['delete'] = function(view) {
			map.socket.emit("deleteView", { id: view.id }, function(err) {
				if(err)
					$scope.error = err;
			});
		};
	});

})(FacilPad, jQuery, angular);