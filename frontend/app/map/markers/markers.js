import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';

fm.app.factory("fmMapMarkers", function($uibModal, fmUtils, $compile, $timeout) {
	return function(map) {
		var markersById = { };

		map.socket.on("marker", function(data) {
			if(map.socket.filterFunc(data))
				markersUi._addMarker(data);
		});

		map.socket.on("deleteMarker", function(data) {
			markersUi._deleteMarker(data);
		});

		map.socket.on("filter", function() {
			for(var i in map.socket.markers) {
				var show = map.socket.filterFunc(map.socket.markers[i]);
				if(markersById[i] && !show)
					markersUi._deleteMarker(map.socket.markers[i]);
				else if(!markersById[i] && show)
					markersUi._addMarker(map.socket.markers[i]);
			}
		});

		var markersUi = {
			_addMarker : function(marker) {
				if(!markersById[marker.id]) {
					markersById[marker.id] = L.marker([ 0, 0 ], { icon: fmUtils.createMarkerIcon(marker.colour, marker.size, marker.symbol)}).addTo(map.map)
						.bindPopup($("<div/>")[0], map.popupOptions)
						.on("popupopen", function(e) {
							markersUi._renderMarkerPopup(map.socket.markers[marker.id] || marker);
						})
						.on("popupclose", function(e) {
							ng.element(e.popup.getContent()).scope().$destroy();
						})
						.bindTooltip("", $.extend({}, map.tooltipOptions, { offset: [ 20, -15 ] }))
						.on("tooltipopen", function() {
							markersById[marker.id].setTooltipContent(fmUtils.quoteHtml(map.socket.markers[marker.id].name));
						});
				}

				markersById[marker.id]
					.setLatLng([ marker.lat, marker.lon ])
					.setIcon(fmUtils.createMarkerIcon(marker.colour, marker.size, marker.symbol));

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
				$(el).html(require("./view-marker.html"));
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
				var scope = map.socket.$new();

				var dialog = $uibModal.open({
					template: require("./edit-marker.html"),
					scope: scope,
					controller: "fmMapMarkerEditCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; }
					}
				});

				var preserve = fmUtils.preserveObject(scope, "markers["+fmUtils.quoteJavaScript(marker.id)+"]", "marker", function() {
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
						map.socket.emit("editMarker", { id: marker.id, lat: pos.lat, lon: pos.lng }).then(function() {
							markersById[marker.id].openPopup();
						}).catch(function(err) {
							map.messages.showMessage("danger", err);
						});
					}
				}

				map.map.closePopup();

				var message = map.messages.showMessage("info", "Drag the marker to reposition it.", [
					{ label: "Save", click: _finish.bind(null, true) },
					{ label: "Cancel", click: _finish}
				], null, _finish);

				markersById[marker.id].dragging.enable();
			},
			deleteMarker: function(marker) {
				map.socket.emit("deleteMarker", marker).catch(function(err) {
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

					markersUi.createMarker(pos, type);
				});
			},
			createMarker: function(pos, type, properties) {
				map.socket.emit("addMarker", $.extend({ lon: pos.lon, lat: pos.lat, typeId: type.id }, properties)).then(function(marker) {
					markersUi._addMarker(marker);

					markersById[marker.id].openPopup();
					markersUi.editMarker(marker);
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
		return map.typesUi.canControl($scope.types[$scope.marker.typeId], what);
	};

	$scope.save = function() {
		$scope.error = null;
		map.socket.emit("editMarker", $scope.marker).then(function() {
			$scope.$close();
		}).catch(function(err) {
			$scope.error = err;
		});
	};

	$scope.$watchGroup([ "marker.colour", "marker.size", "marker.symbol" ], function() {
		map.markersUi._addMarker($scope.marker);
	});


});
