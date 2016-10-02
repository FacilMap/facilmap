(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapPad", [ "fpDialogs", "fpUtils", function(fpDialogs, fpUtils) {
		return function(map) {
			var ret = {
				editPadSettings : function() {
					var scope = map.socket.$new();

					var padDataBkp = ng.copy(scope.padData);

					scope.save = function() {
						var padData = $.extend({ }, map.socket.padData);
						delete padData.defaultView;
						map.socket.emit("editPad", padData, function(err) {
							if(err)
								return scope.error = err;

							padDataBkp = null;
							scope.dialog.close();
						});
					};

					scope.dialog = fpDialogs.open("map/pad/pad-settings.html", scope, "Pad settings", function() {
						if(padDataBkp != null)
							fpUtils.overwriteObject(padDataBkp, scope.padData);
					});
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
	} ]);

})(FacilPad, jQuery, angular);