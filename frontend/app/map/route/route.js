import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import 'leaflet.elevation';
import {saveAs} from 'file-saver';

fm.app.factory("fmMapRoute", function(fmUtils, $uibModal, $compile, $timeout, $rootScope, fmHighlightableLayers) {
	return function(map) {
		var dragTimeout = 300;

		let elevationPlot = L.control.elevation({
			theme: "steelblue-theme",
			position: "bottomright",
			height: 140
		});

		let routeLayer = null;
		let dragMarker = null;
		let markers = [ ];
		let dragging = false;
		let openInfoBox = null;

		function setRoute(route) {
			return map.client.setRoute({
				routePoints: route.routePoints,
				mode: route.mode,
				routeSettings: route.routeSettings
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

				routeLayer = (new fmHighlightableLayers.Polyline(splitLatLngs, {
					color : '#0000ff',
					width : 7,
					highlight: !!openInfoBox,
					rise: true
				})).addTo(map.map).on("click", function(e) {
					routeUi.showRouteInfoBox();
				}.fmWrapApply($rootScope));

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
					var marker = (new fmHighlightableLayers.Marker([ point.lat, point.lon ], {
						colour: map.dragMarkerColour,
						size: 35,
						draggable: true,
						rise: true
					})).addTo(map.map);

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
			.on("dragstart", () => {
				dragging = true;
			}).on("dragend", function() {
				dragging = false;

				let idx = markers.indexOf(marker);
				map.client.route.routePoints[idx] = {lat: marker.getLatLng().lat, lon: marker.getLatLng().lng};
				map.mapEvents.$emit("routeDestinationMove", [idx]);

				return setRoute(map.client.route);
			}.fmWrapApply($rootScope)).on("mouseover", function() {
				map.mapEvents.$emit("routeDestinationMouseOver", [markers.indexOf(marker)]);
			}.fmWrapApply($rootScope)).on("mouseout", function() {
				map.mapEvents.$emit("routeDestinationMouseOut", [markers.indexOf(marker)]);
			}.fmWrapApply($rootScope));
		}

		function updateMarkerColours() {
			markers.forEach(function(marker, i) {
				marker.setStyle({
					colour: (i == 0 ? map.startMarkerColour : i == markers.length-1 ? map.endMarkerColour : map.dragMarkerColour)
				});
			});
		}

		function clearRoute() {
			if(routeLayer) {
				routeLayer.remove();
				routeLayer = null;
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
				if(openInfoBox)
					return;

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

					map.linesUi.createLine(type, map.client.route.routePoints, { mode: map.client.route.mode, routeSettings: map.client.route.routeSettings });

					map.mapEvents.$broadcast("routeClear");
					map.client.clearRoute().catch((err) => {
						map.messages.showMessage("danger", err);
					});
				};

				scope.export = function(useTracks) {
					routeUi.exportRoute(useTracks);
				};

				let template = $(require("./view-route.html"));

				routeLayer.setStyle({
					highlight: true
				});

				openInfoBox = map.infoBox.show(template, scope, () => {
					scope.$destroy();
					openInfoBox = null;

					if(routeLayer) {
						routeLayer.setStyle({
							highlight: false
						});
					}
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
				if(map.client.route) {
					let points = [];
					for(let i=0; i<map.client.route.trackPoints.length; i++) {
						if(map.client.route.trackPoints[i])
							points.push(L.latLng(map.client.route.trackPoints[i].lat, map.client.route.trackPoints[i].lon));
					}

					map.map.flyToBounds(L.latLngBounds(points));
				}
			},

			setRoute(routePoints, mode, routeSettings) {
				return setRoute({routePoints, mode, routeSettings}, true).then(() => {
					if(map.client.route)
						this.showRouteInfoBox();
				});
			},

			lineToRoute(lineId) {
				return map.client.lineToRoute({
					id: lineId
				}).then(() => {
					renderRoute();
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
			},

			exportRoute(useTracks) {
				map.client.exportRoute({
					format: useTracks ? "gpx-trk" : "gpx-rte"
				}).then((exported) => {
					saveAs(new Blob([exported], {type: "application/gpx+xml"}), "FacilMap route.gpx");
				}).catch((err) => {
					map.messages.showMessage("danger", err);
				});
			},

			getMarker(idx) {
				return markers[idx];
			}
		};

		return routeUi;
	}
});