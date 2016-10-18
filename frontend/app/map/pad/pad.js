(function(fm, $, ng, undefined) {

	fm.app.factory("fmMapPad", function($uibModal, fmUtils) {
		return function(map) {
			var ret = {
				createPad : function() {
					ret.editPadSettings(true);
				},
				editPadSettings : function(create) {
					var dialog = $uibModal.open({
						templateUrl: "map/pad/pad-settings.html",
						scope: map.socket,
						controller: "fmMapPadSettingsCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; },
							create: function() { return create; }
						}
					});

					if(!create) {
						// TODO: use child scope!
						var preserve = fmUtils.preserveObject(map.socket, "padData", "padData", function() {
							dialog.dismiss();
						});

						dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
					}
				}
			};

			/*
			$scope.copyPadId = fmUtils.generateRandomPadId();
			$scope.copyPad = function() {
				socket.emit("copyPad", { toId: $scope.copyPadId }, function(err) {
					if(err) {
						$scope.dialogError = err;
						return;
					}

					$scope.closeDialog();
					var url = $scope.urlPrefix + $scope.copyPadId;
					$scope.showMessage("success", "The pad has been copied to", [ { label: url, url: url } ]);
					$scope.copyPadId = fmUtils.generateRandomPadId();
				});
			};
			 */

			return ret;
		};
	});

	fm.app.controller("fmMapPadSettingsCtrl", function($scope, map, create, fmUtils) {
		$scope.create = create;

		if(create) {
			$scope.writeId = fmUtils.generateRandomPadId(14);
			$scope.readId = fmUtils.generateRandomPadId(12);
			$scope.padName = "New FacilMap";
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

					map.socket.updateBbox(fmUtils.leafletToFmBbox(map.map.getBounds(), map.map.getZoom()));

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

		$scope.copy = function(text) {
			fmUtils.copyToClipboard(text);
		}
	});

})(FacilMap, jQuery, angular);