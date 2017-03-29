import fm from '../../app';
import $ from 'jquery';

fm.app.factory("fmMapPad", function($uibModal, fmUtils) {
	return function(map) {
		var ret = {
			createPad : function(proposedWriteId, noCancel) {
				ret.editPadSettings(true, proposedWriteId, noCancel);
			},
			editPadSettings : function(create, proposedWriteId, noCancel) {
				var scope = map.socket.$new();

				var dialog = $uibModal.open({
					template: require("./pad-settings.html"),
					scope: scope,
					controller: "fmMapPadSettingsCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; },
						create: function() { return create; },
						proposedWriteId: function() { return proposedWriteId; },
						noCancel: function() { return noCancel; }
					},
					keyboard: !noCancel,
					backdrop: noCancel ? "static" : true
				});

				if(!create) {
					var preserve = fmUtils.preserveObject(scope, "padData", "padData", function() {
						dialog.dismiss();
					});

					dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
				}
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

fm.app.controller("fmMapPadSettingsCtrl", function($scope, map, create, proposedWriteId, noCancel, fmUtils) {
	$scope.urlPrefix = fm.URL_PREFIX;
	$scope.create = create;
	$scope.noCancel = noCancel;

	if(create) {
		$scope.writeId = (proposedWriteId || fmUtils.generateRandomPadId(14));
		$scope.readId = fmUtils.generateRandomPadId(12);
		$scope.padData = {
			padName: "New FacilMap",
			searchEngines: false,
			description: "",
			clusterMarkers: false
		};
	} else {
		// We don't want to edit those in padData directly, as that would change the URL while we type
		$scope.writeId = $scope.padData.writeId;
		$scope.readId = $scope.padData.id;
	}

	function validateId(id) {
		if(id.indexOf("/") != -1)
			return "May not contain a slash.";
	}

	$scope.$watch("writeId", function(writeId) {
		$scope.writeError = validateId(writeId);
	});

	$scope.$watch("readId", function(readId) {
		$scope.readError = validateId(readId);
	});

	$scope.save = function() {
		let newData = $.extend({}, $scope.padData, {id: $scope.readId, writeId: $scope.writeId});
		if(create) {
			map.socket.createPad(newData).then(function() {
				map.socket.updateBbox(fmUtils.leafletToFmBbox(map.map.getBounds(), map.map.getZoom()));

				$scope.$close();
			}).catch(function(err) {
				$scope.error = err;
			});
		} else {
			map.socket.editPad(newData).then(function() {
				$scope.$close();
			}).catch(function(err) {
				$scope.error = err;
			});
		}
	};

	$scope.copy = function(text) {
		fmUtils.copyToClipboard(text);
	}
});
