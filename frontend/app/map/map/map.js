import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import 'leaflet.locatecontrol';
import 'leaflet.markercluster';
import 'leaflet-mouse-position';
import 'leaflet-graphicscale';
import 'leaflet-auto-graticule';

fm.app.directive("facilmap", function(fmUtils, fmMapMessages, fmMapMarkers, $compile, fmMapLines, fmMapTypes, fmMapViews, $rootScope, fmMapPad, $timeout, $sce, fmMapHistory, $q, fmClient, fmInfoBox, fmMapRoute, fmConfig) {
	return {
		restrict: 'E',
		template: require("./map.html"),
		scope: {
			client: "<fmClient",
			serverUrl: "@fmServerUrl",
			mapId: "@fmMapId"
		},
		transclude: true,
		controller: function($scope, $element) {
			if(!$scope.client)
				$scope.client = new fmClient($scope.serverUrl, $scope.mapId);

			this.mapEvents = $rootScope.$new(true); /* Event types: longmousedown, layerchange, routeDestinationRemove, routeDestinationMove, routePointMouseOver, routePointMouseOut, showObject, searchchange */
			this.client = $scope.client;
			this.el = $($element);

			this.tooltipOptions = {
				direction: "right"
			};

			$scope.loaded = false;

			this.map = L.map($(".fm-map", $element)[0]);

			this.map._controlCorners.bottomcenter = L.DomUtil.create("div", "leaflet-bottom fm-leaflet-center", this.map._controlContainer);

			let locateControl = L.control.locate({
				flyTo: true,
				icon: "a",
				iconLoading: "a"
			}).addTo(this.map);

			$compile($('<fm-icon fm-icon="screenshot" alt="Locate"/>').appendTo($("a", locateControl._container)))($scope);

			L.control.mousePosition({
				emptyString: "0, 0",
				separator: ", ",
				position: "bottomright"
			}).addTo(this.map);

			L.control.graphicScale({
				fill: "hollow",
				position: "bottomcenter"
			}).addTo(this.map);

			this.startMarkerColour = "00ff00";
			this.dragMarkerColour = "ffd700";
			this.endMarkerColour = "ff0000";
			this.searchMarkerColour = "000000";

			if(L.Browser.touch && !L.Browser.pointer) {
				// Long click will call the contextmenu event
				this.map.on("contextmenu", ((e) => {
					this.mapEvents.$broadcast("longmousedown", e.latlng);
				}).fmWrapApply($scope));
			} else {
				fmUtils.onLongMouseDown(this.map, ((e) => {
					this.mapEvents.$broadcast("longmousedown", e.latlng);
				}).fmWrapApply($scope));
			}

			this.map.on("layeradd", () => {
				this.mapEvents.$broadcast("layerchange");
			});

			this.map.on("layerremove", () => {
				this.mapEvents.$broadcast("layerchange");
			});

			$scope.client.interaction = 0;
			$scope.client.loading = 0;

			this.loadStart = () => {
				$scope.client.loading++;
			};

			this.loadEnd = () => {
				$scope.client.loading--;
			};

			this.interactionStart = () => {
				$scope.client.interaction++;
			};

			this.interactionEnd = () => {
				$scope.client.interaction--;
			};

			$scope.client.on("loadStart", () => {
				this.loadStart();
			});

			$scope.client.on("loadEnd", () => {
				this.loadEnd();
			});

			this.messages = fmMapMessages(this);
			this.infoBox = fmInfoBox(this);
			this.markersUi = fmMapMarkers(this);
			this.linesUi = fmMapLines(this);
			this.viewsUi = fmMapViews(this);
			this.typesUi = fmMapTypes(this);
			this.padUi = fmMapPad(this);
			this.historyUi = fmMapHistory(this);
			this.routeUi = fmMapRoute(this);

			this.loadInitialView = () => {
				return $q.resolve().then(() => {
					if(this.client.padId) {
						return $q((resolve) => {
							var loadedWatcher = $scope.$watch("client.padData", (padData) => {
								if(padData != null) {
									loadedWatcher();
									resolve(padData);
								}
							});

							var serverErrorWatcher = $scope.$watch("client.serverError", (serverError) => {
								if(serverError != null) {
									serverErrorWatcher();

									if(serverError.indexOf('does not exist') != -1) {
										$scope.client.serverError = null;
										this.padUi.createPad($scope.client.padId, true);
									}

									resolve();
								}
							});
						});
					}
				}).then((padData) => {
					if(padData) {
						this.displayView(padData.defaultView);
					} else {
						$scope.client.geoip().then((data) => {
							this.displayView(data);
						}).catch((err) => {
							console.error("Error contacting GeoIP service", err);
							this.displayView();
						});
					}
				});
			};

			var errorMessage = null;
			$scope.$watch("client.disconnected", (disconnected) => {
				if(disconnected && !errorMessage && !$scope.client.serverError)
					errorMessage = this.messages.showMessage("danger", "The connection to the server was lost.");
				else if(!disconnected && errorMessage) {
					errorMessage.close();
					errorMessage = null;
				}
			});

			$scope.$watch("client.serverError", (serverError) => {
				if(errorMessage) {
					errorMessage.close();
					errorMessage = null;
				}

				if(serverError)
					errorMessage = this.messages.showMessage("danger", serverError);
			});

			this.client.on("deletePad", () => {
				this.messages.showMessage("danger", "This map has been deleted.", [
					{ url: fm.URL_PREFIX, label: "Close map" }
				]);
			});

			// When no pad is loaded, there is no need to update the bbox, except if a route gets loaded
			let setRoute = $scope.client.setRoute;
			$scope.client.setRoute = function() {
				if(!$scope.client.padId)
					updateBbox();
				return setRoute.apply(this, arguments);
			};
			let lineToRoute = $scope.client.lineToRoute;
			$scope.client.lineToRoute = function() {
				if(!$scope.client.padId)
					updateBbox();
				return lineToRoute.apply(this, arguments);
			};

			$scope.$watch("client.route", () => {
				// When no pad is opened and a route is set for the first time,
				if(!$scope.client.padId && $scope.client.route)
					$scope.client.updateBbox(fmUtils.leafletToFmBbox(this.map.getBounds(), this.map.getZoom()));
			});

			$scope.isInFrame = (parent !== window);
			$scope.$watch(() => (location.href), (url) => {
				$scope.url = `${location.origin}${location.pathname}${location.hash}`;
			});
		},
		link: function(scope, element, attrs, ctrl) {
			// Has to be called after the controller is initialised so that loadInitialView can be overridden by fmHash
			// Delay it even further so that sub-directives are initialised (fm-hash needs to communicate with fm-search)
			setTimeout(() => {
				ctrl.loadInitialView().then(() => {
					scope.loaded = true;
				});
			}, 0);
		}
	};
});
