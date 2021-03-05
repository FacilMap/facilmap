import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';

fm.app.factory("fmMapMarkers", function($uibModal, fmUtils, $compile, $timeout, $rootScope, fmHighlightableLayers, $q) {
	return function(map) {
		var markersById = { };
		let openMarker;

		var markersUi = {
			showMarkerInfoBox: function(marker) {
				var scope = $rootScope.$new();

				scope.map = map;
				scope.client = map.client;
				scope.marker = marker;

				scope.edit = function() {
					markersUi.editMarker(scope.marker);
				};

				scope.move = function() {
					markersUi.moveMarker(scope.marker);
				};

				scope['delete'] = function() {
					scope.saving = true;
					markersUi.deleteMarker(scope.marker);
				};

				scope.useForRoute = function(mode) {
					map.searchUi.setRouteDestination(`${marker.lat},${marker.lon}`, mode);
				};

				openMarker = {
					hide: map.infoBox.show({
						template: require("./view-marker.html"),
						scope,
						onCloseStart: () => {
							openMarker = null;

							if(markersById[marker.id]) {
								markersById[marker.id].setStyle({
									highlight: false
								});
							}
						},
						onCloseEnd: () => {
							scope.$destroy();
						},
						id: `m${marker.id}`,
						center: L.latLng(marker.lat, marker.lon),
						zoom: 15
					}).hide,
					id: marker.id
				};

				markersById[marker.id].setStyle({
					highlight: true
				});
			},
			editMarker: function(marker) {
				$uibModal.open({
					template: require("./edit-marker.html"),
					controller: "fmMapMarkerEditCtrl",
					size: "lg",
					resolve: {
						map: () => (map),
						marker: () => (marker)
					}
				});
			},
			moveMarker: function(marker) {
				if(!markersById[marker.id])
					return;

				map.interactionStart();

				function _finish(save) {
					message.close();

					markersById[marker.id].dragging.disable();

					if(save) {
						var pos = markersById[marker.id].getLatLng();
						map.client.editMarker({ id: marker.id, lat: pos.lat, lon: pos.lng }).then(function(marker) {
							markersUi.showMarkerInfoBox(marker);
							map.interactionEnd();
						}).catch(function(err) {
							map.messages.showMessage("danger", err);

							markersUi._addMarker(map.client.markers[marker.id]);

							map.interactionEnd();
						});
					} else {
						markersUi._addMarker(map.client.markers[marker.id]);
						map.interactionEnd();
					}
				}

				var message = map.messages.showMessage("info", "Drag the marker to reposition it.", [
					{ label: "Save", click: _finish.bind(null, true) },
					{ label: "Cancel", click: _finish}
				], null, _finish);

				markersById[marker.id].dragging.enable();
			},
			deleteMarker: function(marker) {
				map.client.deleteMarker(marker).catch(function(err) {
					map.messages.showMessage("danger", err);
				});
			},
			createMarker: function(pos, type, properties, noEdit) {
				return map.client.addMarker($.extend({ lon: pos.lon, lat: pos.lat, typeId: type.id }, properties)).then(function(marker) {
					markersUi._addMarker(marker);

					if(!noEdit) {
						markersUi.showMarkerInfoBox(marker);
						markersUi.editMarker(marker);
					}
				}).catch(function(err) {
					map.messages.showMessage("danger", err);
				});
			}
		};

		return markersUi;
	};
});

fm.app.controller("fmMapMarkerEditCtrl", function($scope, map, marker, fmUtils) {
	$scope.marker = ng.copy(marker);
	$scope.client = map.client;

	$scope.$watch(() => (map.client.markers[marker.id]), (newMarker, oldMarker) => {
		if(newMarker == null)
			$scope.$dismiss();
		else {
			fmUtils.mergeObject(oldMarker, newMarker, $scope.marker);
			updateModified();
		}
	}, true);

	$scope.$watch("marker", updateModified, true);

	function updateModified() {
		$scope.isModified = !ng.equals($scope.marker, map.client.markers[marker.id]);
	}

	$scope.canControl = function(what) {
		return map.typesUi.canControl($scope.client.types[$scope.marker.typeId], what);
	};

	$scope.save = function() {
		$scope.error = null;
		$scope.saving = true;

		map.client.editMarker($scope.marker).then(function() {
			$scope.$close();
		}).catch(function(err) {
			$scope.saving = false;
			$scope.error = err;
		});
	};


});
