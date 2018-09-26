import fm from '../../app';
import $ from 'jquery';
import ng from 'angular';

fm.app.factory("fmMapPad", function($uibModal, fmUtils, $rootScope) {
	return function(map) {
		var ret = {
			createPad : function(proposedAdminId, noCancel) {
				ret.editPadSettings(true, proposedAdminId, noCancel);
			},
			editPadSettings : function(create, proposedAdminId, noCancel) {
				$uibModal.open({
					template: require("./pad-settings.html"),
					controller: "fmMapPadSettingsCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; },
						create: function() { return create; },
						proposedAdminId: function() { return proposedAdminId; },
						noCancel: function() { return noCancel; }
					},
					keyboard: !noCancel,
					backdrop: noCancel ? "static" : true
				});
			}
		};

		/*
		$scope.copyPadId = fmUtils.generateRandomPadId();
		$scope.copyPad = function() {
			socket.copyPad({ toId: $scope.copyPadId }, function(err) {
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

fm.app.controller("fmMapPadSettingsCtrl", function($scope, map, create, proposedAdminId, noCancel, fmUtils) {
	$scope.urlPrefix = fm.URL_PREFIX;
	$scope.create = create;
	$scope.noCancel = noCancel;

	if(create) {
		$scope.padData = {
			padName: "New FacilMap",
			searchEngines: false,
			description: "",
			clusterMarkers: false,
			adminId: (proposedAdminId || fmUtils.generateRandomPadId(16)),
			writeId: fmUtils.generateRandomPadId(14),
			id: fmUtils.generateRandomPadId(12)
		};
	} else {
		$scope.padData = ng.copy(map.client.padData);

		$scope.$watch(() => (map.client.padData), (newPadData, oldPadData) => {
			fmUtils.mergeObject(oldPadData, newPadData, $scope.padData);
			updateModified();
		}, true);

		$scope.$watch("padData", updateModified, true);

		function updateModified() {
			$scope.isModified = !ng.equals($scope.padData, map.client.padData);
		}
	}

	function validateId(id) {
		if(!id || id.length == "")
			return "Cannot be empty.";
		if(id.indexOf("/") != -1)
			return "May not contain a slash.";
	}

	$scope.$watch("padData.adminId", function(adminId) {
		$scope.adminError = validateId(adminId);
	});

	$scope.$watch("padData.writeId", function(writeId) {
		$scope.writeError = validateId(writeId);
	});

	$scope.$watch("padData.id", function(readId) {
		$scope.readError = validateId(readId);
	});

	$scope.save = function() {
		$scope.saving = true;

		if(create) {
			map.client.createPad($scope.padData).then(function() {
				map.client.updateBbox(fmUtils.leafletToFmBbox(map.map.getBounds(), map.map.getZoom()));

				$scope.$close();
			}).catch(function(err) {
				$scope.error = err;
				$scope.saving = false;
			});
		} else {
			map.client.editPad($scope.padData).then(function() {
				$scope.$close();
			}).catch(function(err) {
				$scope.error = err;
				$scope.saving = false;
			});
		}
	};

	$scope.copy = function(text) {
		fmUtils.copyToClipboard(text);
	}
});
