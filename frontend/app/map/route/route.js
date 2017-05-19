import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import 'leaflet.elevation';

fm.app.factory("fmMapRoute", function(fmUtils, $uibModal, $compile, $timeout, $rootScope) {
	return function(map) {
		var dragTimeout = 300;

		let elevationPlot = L.control.elevation({
			theme: "steelblue-theme",
			position: "bottomright",
			height: 140
		});

		let routeLayer = null;
		let highlightLayer = null;
		let dragMarker = null;
		let markers = [ ];
		let recalcRoute = fmUtils.minInterval(dragTimeout, false);
		let dragging = false;
		let openInfoBox = null;

		function setRoute(route, calcElevation) {
			return map.client.setRoute({
				routePoints: route.routePoints,
				mode: route.mode,
				elevation: !!calcElevation
			}).then(() => {
				renderRoute();
			}).catch((err) => {
				map.messages.showMessage("danger", err);
			});
		}

		function renderRoute() {
			clearRoute();

			if(!map.client.route)
				return;

			if(map.client.route.trackPoints) {
				let trackPoints = [ ];
				for(var i=0; i<map.client.route.trackPoints.length; i++) {
					if(map.client.route.trackPoints[i] != null)
						trackPoints.push(L.latLng(map.client.route.trackPoints[i].lat, map.client.route.trackPoints[i].lon));
				}

				// Two points that are both outside of the viewport should not be connected, as the piece in between
				// has not been received.
				let splitLatLngs = fmUtils.disconnectSegmentsOutsideViewport(trackPoints, map.map.getBounds());

				highlightLayer = L.polyline(splitLatLngs, {
					pane: "fmHighlightShadowPane",
					interactive: false,
					color : '#000000',
					weight : 8,
					opacity : 0.7
				}).addTo(map.map).on("click", function(e) {
					routeUi.showRouteInfoBox();
				}.fmWrapApply($rootScope));

				fmUtils.blurFilter(highlightLayer, "fmLinesBlur", 4);

				routeLayer = L.polyline(splitLatLngs, {
					pane: "fmHighlightPane",
					color : '#0000ff',
					weight : 8,
					opacity : 0.7
				}).addTo(map.map).on("click", function(e) {
					routeUi.showRouteInfoBox();
				}.fmWrapApply($rootScope));

				map.map.almostOver.addLayer(routeLayer);

				dragMarker = fmUtils.temporaryDragMarker(map.map, routeLayer, map.dragMarkerColour, function(marker) {
					dragging = true;

					var latlng = marker.getLatLng();

					let trackPointsArr = [];
					for(let i=0; i<map.client.route.trackPoints.length; i++) {
						if(map.client.route.trackPoints[i])
							trackPointsArr.push(map.client.route.trackPoints[i]);
					}

					var idx = fmUtils.getIndexOnLine(map.map, trackPointsArr, map.client.route.routePoints, { lat: latlng.lat, lon: latlng.lng });

					map.client.route.routePoints.splice(idx, 0, { lat: latlng.lat, lon: latlng.lon });
					markers.splice(idx, 0, marker);

					map.mapEvents.$emit("routeDestinationAdd", [idx]);

					registerMarkerHandlers(marker);
				}.fmWrapApply($rootScope), {
					pane: "fmHighlightMarkerPane"
				});
			}

			if(!dragging) {
				// Render markers

				map.client.route.routePoints.forEach(function(point, i) {
					var marker = L.marker([ point.lat, point.lon ], {
						icon: fmUtils.createMarkerIcon(map.dragMarkerColour, 35),
						draggable: true,
						pane: "fmHighlightMarkerPane"
					}).addTo(map.map);

					registerMarkerHandlers(marker);

					markers.push(marker);
				});

				updateMarkerColours();
			}
		}

		function registerMarkerHandlers(marker) {
			marker.on("dblclick", function() {
				let index = markers.indexOf(marker);
				map.client.route.routePoints.splice(index, 1);
				markers[index].remove();
				markers.splice(index, 1);
				setRoute(map.client.route, true);

				map.mapEvents.$emit("routeDestinationRemove", [index]);
			}.fmWrapApply($rootScope))
			.on("drag", function() {
				recalcRoute(function() {
					let idx = markers.indexOf(marker);
					map.client.route.routePoints[idx] = {lat: marker.getLatLng().lat, lon: marker.getLatLng().lng};
					map.mapEvents.$emit("routeDestinationMove", [idx]);

					return setRoute(map.client.route, false);
				}.fmWrapApply($rootScope));
			})
			.on("dragstart", () => {
				dragging = true;
			}).on("dragend", () => {
				recalcRoute(function() { // To make sure it runs after the last drag event
					dragging = false;

					let idx = markers.indexOf(marker);
					map.client.route.routePoints[idx] = {lat: marker.getLatLng().lat, lon: marker.getLatLng().lng};
					map.mapEvents.$emit("routeDestinationMove", [idx]);

					return setRoute(map.client.route, true);
				});
			});
		}

		function updateMarkerColours() {
			markers.forEach(function(marker, i) {
				var colour = (i == 0 ? map.startMarkerColour : i == markers.length-1 ? map.endMarkerColour : map.dragMarkerColour);

				marker.setIcon(fmUtils.createMarkerIcon(colour, 35));
			});
		}

		function clearRoute() {
			if(routeLayer) {
				map.map.almostOver.removeLayer(routeLayer);
				routeLayer.remove();
				routeLayer = null;
			}

			if(highlightLayer) {
				highlightLayer.remove();
				highlightLayer = null;
			}

			if(dragMarker) {
				dragMarker();
				dragMarker = null;
			}

			if(!dragging) {
				markers.forEach(function(marker) {
					marker.remove();
				});
				markers = [ ];
			}
		}

		$rootScope.$watch(() => (map.client.route), (route) => {
			renderRoute();
		});

		map.client.on("routePoints", (data) => {
			renderRoute();
		});

		let routeUi = {
			showRouteInfoBox() {
				let scope = $rootScope.$new();
				scope.client = map.client;

				scope.addToMap = function(type) {
					if(openInfoBox) {
						openInfoBox.hide();
					}

					if(type == null) {
						for(var i in map.client.types) {
							if(map.client.types[i].type == "line") {
								type = map.client.types[i];
								break;
							}
						}
					}

					map.linesUi.createLine(type, map.client.route.routePoints, { mode: map.client.route.mode });

					map.mapEvents.$broadcast("routeClear");
					map.client.clearRoute().catch((err) => {
						map.messages.showMessage("danger", err);
					});
				};

				let template = $(require("./view-route.html"));

				openInfoBox = map.infoBox.show(template, scope, () => {
					scope.$destroy();
					openInfoBox = null;
				});

				elevationPlot.clear();

				scope.$watch("client.route.trackPoints", (trackPoints) => {
					elevationPlot.clear();

					if(map.client.route && map.client.route.ascent != null) {
						let latlngs = [];
						if(trackPoints) {
							for(let i=0; i<trackPoints.length; i++) {
								if(trackPoints[i] && trackPoints[i].ele != null)
									latlngs.push(Object.assign(new L.latLng(trackPoints[i].lat, trackPoints[i].lon), { meta: { ele: trackPoints[i].ele } }));
							}
						}

						elevationPlot.addData({
							_latlngs: latlngs
						}, {
							on: () => {} // Otherwise a new event handler gets added every single time we add a line, and is never cleared
						});
					}
				}, true);

				let drawElevationPlot = () => {
					elevationPlot.options.width = template.filter(".content").width();
					template.find(".fm-elevation-plot").empty().append($(elevationPlot.onAdd(map.map)).addClass("leaflet-control"));
				};

				template.filter(".content").on("resizeend", drawElevationPlot);
				setTimeout(drawElevationPlot, 0);
			},

			zoom() {
				if(routeLayer)
					map.map.flyToBounds(routeLayer.getBounds());
			},

			setRoute(routePoints, mode) {
				return setRoute({routePoints, mode}, true).then(() => {
					this.showRouteInfoBox();
				});
			},

			clearRoute() {
				map.mapEvents.$broadcast("routeClear");

				if(openInfoBox)
					openInfoBox.hide();

				return map.client.clearRoute();
			},

			hasRoute() {
				return !!map.client.route;
			}
		};

		return routeUi;
	}
});