(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapMarkers", function($uibModal, fpUtils, $templateCache, $compile, $timeout, L) {
		return function(map) {
			var markersById = { };

			map.socket.on("marker", function(data) {
				markersUi._addMarker(data);
			});

			map.socket.on("deleteMarker", function(data) {
				markersUi._deleteMarker(data);
			});

			var markersUi = {
				_addMarker : function(marker) {
					if(!markersById[marker.id]) {
						markersById[marker.id] = L.marker([ 0, 0 ], { icon: fpUtils.createMarkerIcon(marker.colour)}).addTo(map.map)
							.bindPopup($("<div/>")[0], map.popupOptions)
							.on("popupopen", function(e) {
								markersUi._renderMarkerPopup(marker);
							})
							.on("popupclose", function(e) {
								ng.element(e.popup.getContent()).scope().$destroy();
							})
							.bindTooltip("", $.extend({}, map.tooltipOptions, { offset: [ 20, -15 ] }))
							.on("tooltipopen", function() {
								markersById[marker.id].setTooltipContent(fpUtils.quoteHtml(map.socket.markers[marker.id].name));
							});
					}

					markersById[marker.id]
						.setLatLng([ marker.lat, marker.lon ])
						.setIcon(fpUtils.createMarkerIcon(marker.colour));

					if(markersById[marker.id].isPopupOpen())
						markersUi._renderMarkerPopup(marker);
				},
				_deleteMarker : function(marker) {
					if(!markersById[marker.id])
						return;

					markersById[marker.id].removeFrom(map.map);
					delete markersById[marker.id];
				},
				_renderMarkerPopup: function(marker) {
					var scope = map.socket.$new();

					scope.marker = marker;

					scope.edit = function() {
						markersUi.editMarker(scope.marker);
					};

					scope.move = function() {
						markersUi.moveMarker(scope.marker);
					};

					scope['delete'] = function() {
						markersUi.deleteMarker(scope.marker);
					};

					var popup = markersById[marker.id].getPopup();
					var el = popup.getContent();
					$(el).html($templateCache.get("map/markers/view-marker.html"));
					$compile(el)(scope);

					// Prevent popup close on button click
					$("button", el).click(function(e) {
						e.preventDefault();
					});

					$timeout(function() { $timeout(function() { // $compile only replaces variables on next digest
						popup.update();
					}); });
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
					if(!markersById[marker.id])
						return;

					function _finish(save) {
						message.close();

						markersById[marker.id].dragging.disable();

						if(save) {
							var pos = markersById[marker.id].getLatLng();
							map.socket.emit("editMarker", { id: marker.id, lat: pos.lat, lon: pos.lng }, function(err) {
								if(err)
									return map.messages.showMessage("danger", err);

								markersById[marker.id].openPopup();
							});
						}
					}

					map.map.closePopup();

					var message = map.messages.showMessage("info", "Drag the marker or click somewhere on the map to reposition it there.", [
						{ label: "Save", click: _finish.bind(null, true) },
						{ label: "Cancel", click: _finish}
					], null, _finish);

					markersById[marker.id].dragging.enable();
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

					map.map.closePopup();

					var listener = map.addClickListener(function(pos) {
						message.close();

						map.socket.emit("addMarker", { lon: pos.lon, lat: pos.lat, typeId: type.id }, function(err, marker) {
							if(err)
								return map.messages.showMessage("danger", err);

							markersUi._addMarker(marker);

							markersById[marker.id].openPopup();
							markersUi.editMarker(marker);
						});
					});
				}
			};

			return markersUi;
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
			map.markersUi._addMarker($scope.marker);
		});
	});

})(FacilPad, jQuery, angular);