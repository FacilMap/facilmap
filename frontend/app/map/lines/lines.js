import fm from '../../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import heightgraph from '../../leaflet/heightgraph';
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

		map.client.on("line", function(data) {
			setTimeout(function() { // trackPoints needs to be copied over
				if((!map.client._editingLineId || data.id != map.client._editingLineId) && map.client.filterFunc(map.client.lines[data.id]))
					linesUi._addLine(map.client.lines[data.id]);
			}, 0);
		});

		map.client.on("deleteLine", function(data) {
			linesUi._deleteLine(data);
		});

		map.client.on("linePoints", function(data) {
			setTimeout(function() {
				if((!map.client._editingLineId || data.id != map.client._editingLineId) && map.client.filterFunc(map.client.lines[data.id]))
					linesUi._addLine(map.client.lines[data.id]);
			}, 0);
		});

		map.client.on("filter", function() {
			for(var i in map.client.lines) {
				var show = (!map.client._editingLineId || i != map.client._editingLineId) && map.client.filterFunc(map.client.lines[i]);
				if(linesById[i] && !show)
					linesUi._deleteLine(map.client.lines[i]);
				else if(!linesById[i] && show)
					linesUi._addLine(map.client.lines[i]);
			}
		});

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

		let elevationPlot = new heightgraph();
		elevationPlot._map = map.map;

		var linesUi = {
			_addLine: function(line, _doNotRerenderPopup) {
				var trackPoints = [ ];
				var p = line.trackPoints || [ ];
				for(var i=0; i<p.length; i++) {
					if(p[i] != null)
						trackPoints.push(L.latLng(p[i].lat, p[i].lon));
				}

				if(trackPoints.length < 2)
					return linesUi._deleteLine(line);

				if(!linesById[line.id]) {
					linesById[line.id] = (new fmHighlightableLayers.Polyline([ ])).addTo(map.map);

					if(line.id != null) { // We don't want a popup for lines that we are drawing right now
						linesById[line.id]
							.on("click", function(e) {
								linesUi.showLineInfoBox(map.client.lines[line.id]);
							}.fmWrapApply($rootScope))
							.bindTooltip("", $.extend({}, map.tooltipOptions, { sticky: true, offset: [ 20, 0 ] }))
							.on("tooltipopen", function(e) {
								linesById[line.id].setTooltipContent(fmUtils.quoteHtml(map.client.lines[line.id].name)).openTooltip(e.latlng);
							});
					}
				}

				var style = {
					color : '#'+line.colour,
					width : line.width
				};

				if(line.id == null) // We are drawing a line
					style.highlight = true;

				// Two points that are both outside of the viewport should not be connected, as the piece in between
				// has not been received.
				let splitLatLngs = fmUtils.disconnectSegmentsOutsideViewport(trackPoints, map.map.getBounds());

				linesById[line.id].setLatLngs(splitLatLngs).setStyle(style);

				if(line.id != null && openLine && line.id == openLine.id && !_doNotRerenderPopup)
					linesUi.showLineInfoBox(line);
			},
			_deleteLine: function(line) {
				if(line.id != null && openLine && line.id == openLine.id) {
					openLine.hide();
					openLine = null;
				}

				var lineObj = linesById[line.id];
				if(!lineObj)
					return;

				map.map.almostOver.removeLayer(lineObj);
				lineObj.removeFrom(map.map);
				delete linesById[line.id];
			},
			getZoomDestination(line) {
				let bounds = fmUtils.fmToLeafletBbox(line);
				return [
					bounds.getCenter(),
					Math.min(15, map.map.getBoundsZoom(bounds))
				];
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

				scope.$watch("line.trackPoints", () => {
					if(line.ascent != null && line.trackPoints) {
						elevationPlot.addData(line.extraInfo, line.trackPoints);
					}
				}, true);

				let drawElevationPlot = () => {
					let el = template.find(".fm-elevation-plot").empty();

					if(line.ascent != null) {
						let content = template.filter(".content");
						elevationPlot.options.width = content.find(".tab-pane.active").width();
						elevationPlot.options.height = content.height() - content.find(".tab-pane.active dl").outerHeight(true);

						el.append($(elevationPlot.onAdd(map.map)));
					}
				};

				template.filter(".content").on("resizeend", drawElevationPlot);
				setTimeout(drawElevationPlot, 0);
			},
			editLine: function(line) {
				var scope = $rootScope.$new();
				scope.client = map.client;

				var dialog = $uibModal.open({
					template: require("./edit-line.html"),
					scope: scope,
					controller: "fmMapLineEditCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; }
					}
				});

				var preserve = fmUtils.preserveObject(scope, "client.lines["+fmUtils.quoteJavaScript(line.id)+"]", "line", function() {
					dialog.dismiss();
				});

				dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
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
						linesUi.editLine(line);

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

fm.app.controller("fmMapLineEditCtrl", function($scope, map) {
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
