import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import saveAs from 'file-saver';
import heightgraph from '../../leaflet/heightgraph';

fm.app.factory("fmMapRoute", function(fmUtils, $uibModal, $compile, $timeout, $rootScope, fmHighlightableLayers) {
	return function(map) {
		var dragTimeout = 300;

		let elevationPlot = new heightgraph();
		elevationPlot._map = map.map;

		let routeLayer = null;
		let dragMarker = null;
		let markers = [ ];
		let openInfoBox = null;
		let submittedRouteIdx = 0;
		let submittedRoute = null;

		async function setRoute(route, zoom=true) {
			const idx = ++submittedRouteIdx;
			submittedRoute = route;

			clearRoute();
			renderMarkers();

			if(zoom)
				routeUi.zoom();

			try {
				await map.client.clearRoute();

				if(idx != submittedRouteIdx) // Another route has been submitted in the meantime
					return false;

				await map.client.setRoute({
					routePoints: route.routePoints,
					mode: route.mode
				});

				if(idx != submittedRouteIdx) // Another route has been submitted in the meantime
					return false;

				submittedRoute = null;

				renderRoute();

				if(zoom)
					routeUi.zoom();

				return true;
			} catch (err) {
				map.messages.showMessage("danger", err);
			}
		}

		function clearMarkers() {
			markers.forEach(function(marker) {
				marker.remove();
			});
			markers = [ ];
		}

		function renderMarkers() {
			clearMarkers();

			const route = submittedRoute || map.client.route;

			if(route) {
				route.routePoints.forEach(function(point, i) {
					var marker = (new fmHighlightableLayers.Marker([ point.lat, point.lon ], {
						colour: map.dragMarkerColour,
						size: 35,
						draggable: true,
						rise: true
					})).addTo(map.map);

					registerMarkerHandlers(marker, route);

					markers.push(marker);
				});

				markers.forEach(function(marker, i) {
					marker.setStyle({
						colour: (i == 0 ? map.startMarkerColour : i == markers.length-1 ? map.endMarkerColour : map.dragMarkerColour)
					});
				});
			}
		}

		function registerMarkerHandlers(marker, route) {
			marker.on("dblclick", function() {
				if(route.routePoints.length <= 2)
					return;

				let index = markers.indexOf(marker);
				route.routePoints.splice(index, 1);
				markers[index].remove();
				markers.splice(index, 1);
				setRoute(route, false);

				map.mapEvents.$emit("routeDestinationRemove", [index]);
			}.fmWrapApply($rootScope))
			.on("dragend", function() {
				let idx = markers.indexOf(marker);
				route.routePoints[idx] = {lat: marker.getLatLng().lat, lon: marker.getLatLng().lng};
				map.mapEvents.$emit("routeDestinationMove", [idx, route.routePoints[idx]]);

				setRoute(route, false);
			}.fmWrapApply($rootScope)).on("fmMouseOver", function() {
				map.mapEvents.$emit("routeDestinationMouseOver", [markers.indexOf(marker)]);
			}.fmWrapApply($rootScope)).on("fmMouseOut", function() {
				map.mapEvents.$emit("routeDestinationMouseOut", [markers.indexOf(marker)]);
			}.fmWrapApply($rootScope));
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
					// The marker has been created and is now in the process of draggging

					var latlng = marker.getLatLng();

					let trackPointsArr = [];
					for(let i=0; i<map.client.route.trackPoints.length; i++) {
						if(map.client.route.trackPoints[i])
							trackPointsArr.push(map.client.route.trackPoints[i]);
					}

					var point = { lat: latlng.lat, lon: latlng.lng };
					var idx = fmUtils.getIndexOnLine(map.map, trackPointsArr, map.client.route.routePoints, point);

					map.client.route.routePoints.splice(idx, 0, point);
					markers.splice(idx, 0, marker);

					map.mapEvents.$emit("routeDestinationAdd", [idx, point]);

					registerMarkerHandlers(marker, map.client.route);
				}.fmWrapApply($rootScope), {
					pane: "fmHighlightMarkerPane"
				});
			}
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
		}

		map.client.on("routePoints", (data) => {
			renderRoute();
		});

		let routeUi = {
			showRouteInfoBox() {
				let scope = $rootScope.$new();
				scope.client = map.client;

				let template = $(require("./view-route.html"));

				openInfoBox = map.infoBox.show({
					template,
					scope,
					onCloseStart: () => {
						openInfoBox = null;

						if(routeLayer) {
							routeLayer.setStyle({
								highlight: false
							});
						}
					},
					onCloseEnd: () => {
						scope.$destroy();
					}
				});

				routeLayer.setStyle({
					highlight: true
				});

				let drawElevationPlot = () => {
					let content = template.filter(".content");
					elevationPlot.options.width = content.width();
					elevationPlot.options.height = content.height() - content.find("dl").outerHeight(true);

					template.find(".fm-elevation-plot").empty().append($(elevationPlot.onAdd(map.map)));
				};

				template.filter(".content").on("resizeend", drawElevationPlot);
				setTimeout(drawElevationPlot, 0);

				scope.$watch("client.route", () => {
					scope.elevationStats = null;
					if(map.client.route && map.client.route.ascent != null) {
						elevationPlot.addData(map.client.route.extraInfo, map.client.route.trackPoints);
						scope.elevationStats = heightgraph.createElevationStats(map.client.route.extraInfo, map.client.route.trackPoints);
					}
				}, true);
			},

			getZoomDestination() {
				let routePoints = submittedRoute ? submittedRoute.routePoints : map.client.route ? map.client.route.trackPoints : null;

				if(routePoints) {
					let points = [];
					for(let i=0; i<routePoints.length; i++) {
						if(routePoints[i])
							points.push(L.latLng(routePoints[i].lat, routePoints[i].lon));
					}

					let bounds = L.latLngBounds(points);

					return [ bounds.getCenter(), map.map.getBoundsZoom(bounds) ];
				}
			},

			zoom() {
				if(submittedRoute || map.client.route) {
					let [ center, zoom ] = routeUi.getZoomDestination();
					map.map.flyTo(center, zoom);
				}
			},

			setRoute(routePoints, mode, zoom=true) {
				return setRoute({routePoints, mode}, zoom).then((wasLoaded) => {
					if(wasLoaded && map.client.route)
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

				clearMarkers();
				clearRoute();
				return map.client.clearRoute();
			},

			hasRoute() {
				return !!map.client.route;
			},

			exportRoute(useTracks) {
				
			},

			getMarker(idx) {
				return markers[idx];
			}
		};

		return routeUi;
	}
});