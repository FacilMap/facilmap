(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapPad", function($uibModal, fpUtils) {
		return function(map) {
			var ret = {
				editPadSettings : function() {
					var dialog = $uibModal.open({
						templateUrl: "map/pad/pad-settings.html",
						scope: map.socket,
						controller: "fpMapPadSettingsCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; }
						}
					});

					var preserve = fpUtils.preserveObject(map.socket, "padData", "padData", function() {
						dialog.dismiss();
					});

					dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
				}
			};

			/*
			$scope.copyPadId = fpUtils.generateRandomPadId();
			$scope.copyPad = function() {
				socket.emit("copyPad", { toId: $scope.copyPadId }, function(err) {
					if(err) {
						$scope.dialogError = err;
						return;
					}

					$scope.closeDialog();
					var url = $scope.urlPrefix + $scope.copyPadId;
					$scope.showMessage("success", "The pad has been copied to", [ { label: url, url: url } ]);
					$scope.copyPadId = fpUtils.generateRandomPadId();
				});
			};
			 */

			return ret;
		};
	});

	fp.app.controller("fpMapPadSettingsCtrl", function($scope, map) {
		$scope.save = function() {
			var padData = $.extend({ }, map.socket.padData);
			delete padData.defaultView;
			map.socket.emit("editPad", padData, function(err) {
				if(err)
					return $scope.error = err;

				$scope.$close();
			});
		};
	});

})(FacilPad, jQuery, angular);