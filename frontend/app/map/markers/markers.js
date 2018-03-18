import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';

fm.app.factory("fmMapMarkers", function($uibModal, fmUtils, $compile, $timeout, $rootScope, fmHighlightableLayers, $q) {
	return function(map) {
		var markersById = { };
		let openMarker;

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

		map.mapEvents.$on("showObject", (event, id, zoom) => {
			let m = id.match(/^m(\d+)$/);
			if(m) {
				event.preventDefault();

				$q.resolve().then(() => {
					return map.client.markers[id] || map.client.getMarker({ id: m[1] });
				}).then(((marker) => {
					if(zoom)
						map.map.flyTo([marker.lat, marker.lon], 15);

					markersUi._addMarker(marker);
					markersUi.showMarkerInfoBox(marker);
				}).fmWrapApply($rootScope)).catch((err) => {
					map.messages.showMessage("danger", err);
				});
			}
		});

		var markersUi = {
			_addMarker : function(marker) {
				if(!markersById[marker.id]) {
					markersById[marker.id] = (new fmHighlightableLayers.Marker([ 0, 0 ])).addTo(map.markerCluster)
						.on("click", function(e) {
							markersUi.showMarkerInfoBox(map.client.markers[marker.id] || marker);
						}.fmWrapApply($rootScope))
						.bindTooltip("", $.extend({}, map.tooltipOptions, { offset: [ 20, -15 ] }))
						.on("tooltipopen", function() {
							markersById[marker.id].setTooltipContent(fmUtils.quoteHtml(map.client.markers[marker.id].name));
						});
				}

				markersById[marker.id]
					.setLatLng([ marker.lat, marker.lon ])
					.setStyle({
						colour: marker.colour,
						size: marker.size,
						symbol: marker.symbol,
						shape: marker.shape,
						highlight: openMarker && openMarker.id == marker.id
					});

				if(openMarker && openMarker.id == marker.id)
					markersUi.showMarkerInfoBox(marker);
			},
			_deleteMarker : function(marker) {
				if(!markersById[marker.id])
					return;

				if(openMarker && openMarker.id == marker.id) {
					openMarker.hide();
					openMarker = null;
				}

				markersById[marker.id].removeFrom(map.map);
				delete markersById[marker.id];
			},
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

fm.app.controller("fmMapMarkerEditCtrl", function($scope, map) {
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

	$scope.$watchGroup([ "marker.colour", "marker.size", "marker.symbol", "marker.shape" ], function() {
		map.markersUi._addMarker($scope.marker);
	});


});
