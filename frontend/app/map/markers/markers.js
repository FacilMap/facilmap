(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapMarkers", function($uibModal, fpUtils, $templateCache, $compile, $timeout) {
		return function(map) {
			var ret = {
				renderMarkerPopup: function(marker, el, callback) {
					var scope = map.socket.$new();

					scope.marker = marker;

					scope.edit = function() {
						ret.editMarker(scope.marker);
					};

					scope.move = function() {
						ret.moveMarker(scope.marker);
					};

					scope['delete'] = function() {
						ret.deleteMarker(scope.marker);
					};

					/*scope.$watch("markers["+fpUtils.quoteJavaScript(marker.id)+"]", function(newVal) {
						if(newVal == null)
							popup.close();
						else {
							scope.marker = newVal;
							popup.updatePosition(newVal);
						}
					}, true);*/

					el.html($templateCache.get("map/markers/view-marker.html"));
					$compile(el[0])(scope);

					$timeout(function() { $timeout(callback); }); // $compile only replaces variables on next digest
				},
				editMarker: function(marker) {
					var dialog = $uibModal.open({
						templateUrl: "map/markers/edit-marker.html",
						scope: map.socket,
						controller: "fpMapMarkerEditCtrl",
						size: "lg",
						resolve: {
							marker: function() { return marker; },
							map: function() { return map; }
						}
					});

					var preserve = fpUtils.preserveObject(map.socket, "markers["+fpUtils.quoteJavaScript(marker.id)+"]", "marker", function() {
						dialog.dismiss();
					});

					dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
				},
				moveMarker: function(marker) {
					var message = map.messages.showMessage("info", "Click somewhere on the map to reposition the marker there.", [
						{ label: "Cancel", click: function() {
							message.close();
							listener.cancel();
						}}
					], null, function() { listener.cancel() });

					map.popups.closeAll();

					var listener = map.addClickListener(function(pos) {
						message.close();

						map.socket.emit("editMarker", { id: marker.id, lat: pos.lat, lon: pos.lon }, function(err) {
							if(err)
								return map.messages.showMessage("danger", err);

							ret.viewMarker(marker);
						});
					});
				},
				deleteMarker: function(marker) {
					map.socket.emit("deleteMarker", marker, function(err) {
						if(err)
							map.messages.showMessage("danger", err);
					});
				},
				addMarker: function(type) {
					var message = map.messages.showMessage("info", "Please click on the map to add a marker.", [
						{ label: "Cancel", click: function() {
							message.close();
							listener.cancel();
						}}
					], null, function() { listener.cancel(); });

					map.popups.closeAll();

					var listener = map.addClickListener(function(pos) {
						message.close();

						map.socket.emit("addMarker", { lon: pos.lon, lat: pos.lat, typeId: type.id }, function(err, marker) {
							if(err)
								return map.messages.showMessage("danger", err);

							ret.viewMarker(marker);
							ret.editMarker(marker);
						});
					});
				}
			};

			return ret;
		};
	});

	fp.app.controller("fpMapMarkerEditCtrl", function($scope, map, marker) {
		$scope.marker = marker;

		$scope.canControl = function(what) {
			return map.typesUi.canControl($scope.types[$scope.marker.typeId], what);
		};

		$scope.save = function() {
			$scope.error = null;
			map.socket.emit("editMarker", $scope.marker, function(err) {
				if(err)
					return $scope.error = err;

				$scope.$close();
			});
		};

		$scope.$watch("marker.colour", function() {
			map.addMarker($scope.marker);
		});
	});

})(FacilPad, jQuery, angular);