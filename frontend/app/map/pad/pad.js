(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapPad", function($uibModal, fpUtils) {
		return function(map) {
			var ret = {
				createPad : function() {
					ret.editPadSettings(true);
				},
				editPadSettings : function(create) {
					var dialog = $uibModal.open({
						templateUrl: "map/pad/pad-settings.html",
						scope: map.socket,
						controller: "fpMapPadSettingsCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; },
							create: function() { return create; }
						}
					});

					if(!create) {
						// TODO: use child scope!
						var preserve = fpUtils.preserveObject(map.socket, "padData", "padData", function() {
							dialog.dismiss();
						});

						dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
					}
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

	fp.app.controller("fpMapPadSettingsCtrl", function($scope, map, create, fpUtils) {
		$scope.create = create;

		if(create) {
			$scope.writeId = fpUtils.generateRandomPadId(14);
			$scope.readId = fpUtils.generateRandomPadId(12);
			$scope.padName = "New FacilPad";
		} else {
			$scope.writeId = map.socket.padData.writeId;
			$scope.readId = map.socket.padData.id;
			$scope.padName = map.socket.padData.name;
		}

		$scope.save = function() {
			var newData = {
				name: $scope.padName,
				id: $scope.readId,
				writeId: $scope.writeId
			};

			if(create) {
				map.socket.emit("createPad", newData, function(err) {
					if(err)
						return $scope.error = err;

					map.socket.updateBbox(fpUtils.leafletToFpBbox(map.map.getBounds(), map.map.getZoom()));

					$scope.$close();
				});
			} else {
				map.socket.emit("editPad", newData, function(err) {
					if(err)
						return $scope.error = err;

					$scope.$close();
				});
			}
		};
	});

})(FacilPad, jQuery, angular);