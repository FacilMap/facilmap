import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';

fm.app.factory("fmMapMarkers", function($uibModal, fmUtils, $compile, $timeout, $rootScope) {
	return function(map) {
		var markersById = { };
		let openMarkerId;

		map.client.on("marker", function(data) {
			if(map.client.filterFunc(data))
				markersUi._addMarker(data);
		});

		map.client.on("deleteMarker", function(data) {
			markersUi._deleteMarker(data);
		});

		map.client.on("filter", function() {
			for(var i in map.client.markers) {
				var show = map.client.filterFunc(map.client.markers[i]);
				if(markersById[i] && !show)
					markersUi._deleteMarker(map.client.markers[i]);
				else if(!markersById[i] && show)
					markersUi._addMarker(map.client.markers[i]);
			}
		});

		var markersUi = {
			_addMarker : function(marker) {
				if(!markersById[marker.id]) {
					markersById[marker.id] = L.marker([ 0, 0 ], { icon: fmUtils.createMarkerIcon(marker.colour, marker.size, marker.symbol)}).addTo(map.markerCluster)
						.on("click", function(e) {
							markersUi._renderMarkerInfoBox(map.client.markers[marker.id] || marker);
						}.fmWrapApply($rootScope))
						.bindTooltip("", $.extend({}, map.tooltipOptions, { offset: [ 20, -15 ] }))
						.on("tooltipopen", function() {
							markersById[marker.id].setTooltipContent(fmUtils.quoteHtml(map.client.markers[marker.id].name));
						});
				}

				markersById[marker.id]
					.setLatLng([ marker.lat, marker.lon ])
					.setIcon(fmUtils.createMarkerIcon(marker.colour, marker.size, marker.symbol));

				if(openMarkerId == marker.id)
					markersUi._renderMarkerInfoBox(marker);
			},
			_deleteMarker : function(marker) {
				if(!markersById[marker.id])
					return;

				markersById[marker.id].removeFrom(map.map);
				delete markersById[marker.id];
			},
			_renderMarkerInfoBox: function(marker) {
				var scope = $rootScope.$new();

				scope.client = map.client;

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

				map.infoBox.show(require("./view-marker.html"), scope, true, () => {
					openMarkerId = null;
					markersById[marker.id].setIcon(fmUtils.createMarkerIcon(marker.colour, marker.size, marker.symbol));
				});

				markersById[marker.id].setIcon(fmUtils.createMarkerIcon(marker.colour, marker.size, marker.symbol, null, true));

				openMarkerId = marker.id;
			},
			editMarker: function(marker) {
				var scope = $rootScope.$new();
				scope.client = map.client;

				var dialog = $uibModal.open({
					template: require("./edit-marker.html"),
					scope: scope,
					controller: "fmMapMarkerEditCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; }
					}
				});

				var preserve = fmUtils.preserveObject(scope, "client.markers["+fmUtils.quoteJavaScript(marker.id)+"]", "marker", function() {
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
						map.client.editMarker({ id: marker.id, lat: pos.lat, lon: pos.lng }).then(function() {
							markersUi._renderMarkerInfoBox(markersById[marker.id]);
						}).catch(function(err) {
							map.messages.showMessage("danger", err);

							markersUi._addMarker(map.client.markers[marker.id]);
						});
					} else {
						markersUi._addMarker(map.client.markers[marker.id]);
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
			addMarker: function(type) {
				var message = map.messages.showMessage("info", "Please click on the map to add a marker.", [
					{ label: "Cancel", click: function() {
						message.close();
						listener.cancel();
					}}
				], null, function() { listener.cancel(); });

				var listener = map.addClickListener(function(pos) {
					message.close();

					markersUi.createMarker(pos, type);
				});
			},
			createMarker: function(pos, type, properties, noEdit) {
				return map.client.addMarker($.extend({ lon: pos.lon, lat: pos.lat, typeId: type.id }, properties)).then(function(marker) {
					markersUi._addMarker(marker);

					if(!noEdit) {
						markersUi._renderMarkerInfoBox(marker);
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

fm.app.controller("fmMapMarkerEditCtrl", function($scope, map) {
	$scope.canControl = function(what) {
		return map.typesUi.canControl($scope.client.types[$scope.marker.typeId], what);
	};

	$scope.save = function() {
		$scope.error = null;
		map.client.editMarker($scope.marker).then(function() {
			$scope.$close();
		}).catch(function(err) {
			$scope.error = err;
		});
	};

	$scope.$watchGroup([ "marker.colour", "marker.size", "marker.symbol" ], function() {
		map.markersUi._addMarker($scope.marker);
	});


});
