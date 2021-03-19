import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import heightgraph from '../../../src/utils/heightgraph';
import saveAs from 'file-saver';

import css from './lines.scss';

fm.app.factory("fmMapLines", function(fmUtils, $uibModal, $compile, $timeout, $rootScope, fmHighlightableLayers) {
	return function(map) {
		var linesById = { };

		let openLine = null;

		let linePopupBaseScope = $rootScope.$new();
		linePopupBaseScope.persistentSettings = {};
		linePopupBaseScope.client = map.client;
		linePopupBaseScope.className = css.className;

		map.mapEvents.$on("showObject", async (event, id, zoom) => {
			let m = id.match(/^l(\d+)$/);
			if(m) {
				event.preventDefault();

				map.client.awaitPadData().then((() => {
					let line = map.client.lines[m[1]];

					if(!line)
						return;

					if(zoom) {
						let [center, zoom] = linesUi.getZoomDestination(line);
						map.map.flyTo(center, zoom);
					}

					linesUi.showLineInfoBox(line);
				})).catch((err) => {
					map.messages.showMessage("danger", err);
				});
			}
		});

		

		var linesUi = {
			_addLine: function(line, _doNotRerenderPopup) {
			},
			_deleteLine: function(line) {
			},
			getZoomDestination(line) {
				
			},
			showLineInfoBox: function(line) {
				var scope = linePopupBaseScope.$new();

				scope.line = line;

				scope.edit = function() {
					linesUi.editLine(scope.line);
				};

				scope.move = function() {
					linesUi.moveLine(scope.line);
				};

				scope['delete'] = function() {
					scope.saving = true;
					linesUi.deleteLine(scope.line);
				};

				scope.export = function(useTracks) {
					linesUi.exportLine(line, useTracks);
				};

				scope.$watch(() => (!!map.routeUi), (canMoveLine) => {
					scope.canMoveLine = canMoveLine;
				});

				let template = $(require("./view-line.html"));

				let [center, zoom] = linesUi.getZoomDestination(line);

				openLine = {
					hide: map.infoBox.show({
						template,
						scope,
						onCloseStart: () => {
							openLine = null;
							if(linesById[line.id]) { // Does not exist anymore after line was deleted
								linesById[line.id].setStyle({ highlight: false });
							}
						},
						onCloseEnd: () => {
							scope.$destroy();
						},
						id: `l${line.id}`,
						center,
						zoom
					}).hide,
					id: line.id
				};

				if(linesById[line.id])
					linesById[line.id].setStyle({ highlight: true });

				template.filter(".content").on("resizeend", drawElevationPlot);
				setTimeout(drawElevationPlot, 0);
			},
			editLine: function(line) {
				$uibModal.open({
					template: require("./edit-line.html"),
					controller: "fmMapLineEditCtrl",
					size: "lg",
					resolve: {
						map: () => (map),
						line: () => (line)
					}
				});
			},
			addLine: function(type) {
				map.client.getLineTemplate({ typeId: type.id }).then(function(line) {

					line.routePoints = [ ];
					line.trackPoints = [ ];
					var message = map.messages.showMessage("info", "Please click on the map to draw a line. Double-click to finish it.", [
						{ label: "Finish", click: finishLine.bind(null, true) },
						{ label: "Cancel", click: finishLine.bind(null, false) }
					], null, finishLine.bind(null, false, true));

					var handler = null;

					function addPoint(pos) {
						line.routePoints.push(pos);
						line.trackPoints = [ ].concat(line.routePoints, [ pos ]); // Add pos a second time so that it gets overwritten by mouseMoveListener
						linesUi._addLine(line);
						handler = map.addClickListener(mapClick, mouseMove);
					}

					function finishLine(save, noClose) {
						if(!noClose)
							message.close();

						handler && handler.cancel();
						linesUi._deleteLine(line);

						if(save && line.routePoints.length >= 2)
							linesUi.createLine(type, line.routePoints);
					}

					var mapClick = function(pos) {
						if(line.routePoints.length > 0 && pos.lon == line.routePoints[line.routePoints.length-1].lon && pos.lat == line.routePoints[line.routePoints.length-1].lat)
							finishLine(true);
						else
							addPoint(pos);
					};

					var mouseMove = function(pos) {
						if(line.trackPoints.length > 0) {
							line.trackPoints[line.trackPoints.length-1] = pos;
							linesUi._addLine(line);
						}
					};

					handler = map.addClickListener(mapClick, mouseMove);
				}).catch(function(err) {
					map.messages.showMessage("danger", err);
				});
			},
			createLine: function(type, routePoints, properties, noEdit) {
				return map.client.addLine($.extend({ routePoints: routePoints, typeId: type.id }, properties)).then(function(line) {
					if(!noEdit) {
						linesUi.editLine(map.client.lines[line.id] || line);

						// We have to wait until the server sends us the trackPoints of the line
						var removeWatcher = $rootScope.$watch(function() { return !!linesById[line.id]; }, function(exists) {
							if(exists) {
								linesUi.showLineInfoBox(map.client.lines[line.id]);
								removeWatcher();
							}
						});
					}
				}).catch(function(err) {
					map.messages.showMessage("danger", err);
				});
			},
			moveLine: function(line) {
				map.interactionStart();

				map.routeUi.lineToRoute(line.id).then(() => {
					map.client._editingLineId = line.id;
					linesUi._deleteLine(line);

					let message = map.messages.showMessage("info", "Drag the line points around to change it. Double-click a point to remove it.", [
						{ label: "Finish", click: done.bind(null, true), enabled: () => (!!map.client.route) },
						{ label: "Cancel", click: done.bind(null, false) }
					], null, done.bind(null, false, true));

					let searchBkp;
					if(map.searchUi) {
						searchBkp = map.searchUi.getSubmittedSearch() || "";
						map.searchUi.route(map.client.route.routePoints.map((routePoint) => (fmUtils.round(routePoint.lat, 5) + "," + fmUtils.round(routePoint.lon, 5))), map.client.route.mode, false, true);
					}

					function done(save, noClose) {
						map.client._editingLineId = null;
						linesUi._addLine(map.client.lines[line.id]);
						linesUi.showLineInfoBox(map.client.lines[line.id]);

						if(!noClose) {
							message.close();
						}

						if(save && !map.client.route) {
							map.messages.showMessage("danger", "No route set.");
							return;
						}

						Promise.resolve().then(() => {
							if(save) {
								return map.client.editLine({ id: line.id, routePoints: map.client.route.routePoints, mode: map.client.route.mode });
							}
						}).then(() => {
							// Clear route after editing line so that the server can take the trackPoints from the route
							let ret = map.routeUi.clearRoute();

							if(map.searchUi) {
								map.searchUi.route([], null, false, true);
								map.searchUi.search(searchBkp, true);
							}

							map.interactionEnd();

							return ret;
						}).catch(function(err) {
							map.interactionEnd();
							map.messages.showMessage("danger", err);
						});
					}
				}).catch((err) => {
					map.interactionEnd();

					console.log("err", err);
					map.messages.showMessage("danger", err);
				});
			},
			deleteLine: function(line) {
				map.client.deleteLine(line).catch(function(err) {
					map.messages.showMessage("danger", err);
				});
			},
			exportLine: function(line, useTracks) {
				map.client.exportLine({
					id: line.id,
					format: useTracks ? "gpx-trk" : "gpx-rte"
				}).then((exported) => {
					saveAs(new Blob([exported], {type: "application/gpx+xml"}), `${line.name}.gpx`);
				}).catch((err) => {
					map.messages.showMessage("danger", err);
				});
			}
		};

		return linesUi;
	};
});

fm.app.controller("fmMapLineEditCtrl", function($scope, map, line, fmUtils) {
	$scope.line = ng.copy(line);
	$scope.client = map.client;

	$scope.$watch(() => (map.client.lines[line.id]), (newLine, oldLine) => {
		if(newLine == null)
			$scope.$dismiss();
		else {
			fmUtils.mergeObject(oldLine, newLine, $scope.line);
			updateModified();
		}
	}, true);

	$scope.$watch("line", updateModified, true);

	function updateModified() {
		$scope.isModified = !ng.equals($scope.line, map.client.lines[line.id]);
	}

	$scope.canControl = function(what) {
		return map.typesUi.canControl($scope.client.types[$scope.line.typeId], what);
	};

	$scope.save = function() {
		$scope.error = null;
		$scope.saving = true;

		var lineObj = ng.copy($scope.line);
		delete lineObj.trackPoints;

		map.client.editLine(lineObj).then(function() {
			$scope.$close();
		}).catch(function(err) {
			$scope.saving = false;
			return $scope.error = err;
		});
	};

	$scope.$watchGroup([ "line.colour", "line.width" ], function() {
		map.linesUi._addLine($scope.line);
	});
});
