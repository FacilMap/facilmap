(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapLines", function(fpUtils, $uibModal, $templateCache, $compile, $timeout) {
		return function(map) {
			var linesById = { };
			var editingLineId = null;

			map.socket.on("line", function(data) {
				setTimeout(function() { // trackPoints needs to be copied over
					linesUi._addLine(map.socket.lines[data.id]);
				}, 0);
			});

			map.socket.on("deleteLine", function(data) {
				linesUi._deleteLine(data);
			});

			map.socket.on("linePoints", function(data) {
				setTimeout(function() {
					linesUi._addLine(map.socket.lines[data.id]);
				}, 0);
			});

			var linesUi = {
				_addLine: function(line) {
					var trackPoints = [ ];
					var p = (editingLineId != null && editingLineId == line.id ? line.routePoints : line.trackPoints) || [ ];
					for(var i=0; i<p.length; i++) {
						if(p[i] != null)
							trackPoints.push(L.latLng(p[i].lat, p[i].lon));
					}

					if(trackPoints.length < 2)
						return linesUi._deleteLine(line);

					if(!linesById[line.id]) {
						linesById[line.id] = L.polyline([ ]).addTo(map.map);
						map.map.almostOver.addLayer(linesById[line.id]);

						if(line.id != null) { // We don't want a popup for lines that we are drawing right now
							linesById[line.id]
								.bindPopup($("<div/>")[0], map.popupOptions)
								.on("popupopen", function(e) {
									linesUi._renderLinePopup(line);
								})
								.on("popupclose", function(e) {
									ng.element(e.popup.getContent()).scope().$destroy();
								});
						}
					}

					var style = {
						color : '#'+line.colour,
						weight : line.width,
						opacity : 0.7
					};

					var same = ng.equals(linesById[line.id].getLatLngs(), trackPoints);

					linesById[line.id].setLatLngs(trackPoints).setStyle(style);

					if(line.id != null && linesById[line.id].isPopupOpen()) {
						if(same)
							linesUi._renderLinePopup(line);
						else
							linesById[line.id].openPopup();
					}
				},
				_deleteLine: function(line) {
					var lineObj = linesById[line.id];
					if(!lineObj)
						return;

					map.map.almostOver.removeLayer(lineObj);
					lineObj.removeFrom(map.map);
					delete linesById[line.id];
				},
				_renderLinePopup: function(line) {
					var scope = map.socket.$new();

					scope.line = line;

					scope.edit = function() {
						linesUi.editLine(scope.line);
					};

					scope.move = function() {
						linesUi.moveLine(scope.line);
					};

					scope['delete'] = function() {
						linesUi.deleteLine(scope.line);
					};

					var popup = linesById[line.id].getPopup();
					var el = popup.getContent();
					$(el).html($templateCache.get("map/lines/view-line.html"));
					$compile(el)(scope);

					// Prevent popup close on button click
					$("button", el).click(function(e) {
						e.preventDefault();
					});

					$timeout(function() { $timeout(function() { // $compile only replaces variables on next digest
						popup.update();
					}); });
				},
				_makeLineMovable: function(line) {
					var markers = [ ];
					var routePointsBkp = ng.copy(line.routePoints);

					var unregisterWatcher = map.socket.$watch(function() { return map.socket.lines[line.id].routePoints; }, function() {
						if(ng.equals(routePointsBkp, map.socket.lines[line.id].routePoints))
							map.socket.lines[line.id].routePoints = line.routePoints;
						else
							routePointsBkp = ng.copy(line.routePoints);

						line = map.socket.lines[line.id];
						end();
						start();
					});

					function start() {
						editingLineId = line.id;

						line.routePoints.forEach(function(it) {
							var marker = L.marker([ it.lat, it.lon ], {
								icon: map.dragIcon,
								draggable: true
							}).addTo(map.map)
								.on("dblclick", function() {
									var idx = markers.indexOf(marker);
									markers.splice(idx, 1);
									line.routePoints.splice(idx, 1);
									marker.remove();
									linesUi._addLine(line);
								})
								.on("drag", function() {
									var idx = markers.indexOf(marker);
									var latlng = marker.getLatLng();
									line.routePoints[idx] = { lat: latlng.lat, lon: latlng.lng };
									linesUi._addLine(line);
								});


							markers.push(marker);
						});

						linesUi._addLine(line);
					}

						/*else if(feature.fmStartLonLat) { // New marker
							var index = fm.Util.lonLatIndexOnLine(feature.fmStartLonLat, feature.fmLine.geometry);
							if(index != null) {
								var newIndex = line.routePoints.length;
								var indexes = [ ];
								for(var i=0; i<newIndex; i++) {
									indexes.push(fm.Util.lonLatIndexOnLine(fm.Util.toMapProjection(new ol.LonLat(line.routePoints[i].lon, line.routePoints[i].lat), map.map), feature.fmLine.geometry));
									if(index < fm.Util.lonLatIndexOnLine(fm.Util.toMapProjection(new ol.LonLat(line.routePoints[i].lon, line.routePoints[i].lat), map.map), feature.fmLine.geometry))
										newIndex = i;
								}

								var lonlat = fm.Util.fromMapProjection(feature.fmStartLonLat, map.map);
								line.routePoints.splice(newIndex, 0, { lat: lonlat.lat, lon: lonlat.lon });
								markers.splice(newIndex, 0, feature);
								map.addLine(line);
							}
							else
								console.warn("Index = null", feature.fmStartLonLat);
						}*/

					function end() {
						editingLineId = null;

						for(var i=0; i<markers.length; i++)
							markers[i].remove();
						markers = [ ];
					}

					return {
						done : function() {
							unregisterWatcher();
							end();
							return line.routePoints;
						}
					};
				},
				editLine: function(line) {
					var dialog = $uibModal.open({
						templateUrl: "map/lines/edit-line.html",
						scope: map.socket,
						controller: "fpMapLineEditCtrl",
						size: "lg",
						resolve: {
							line: function() { return line; },
							map: function() { return map; }
						}
					});

					var preserve = fpUtils.preserveObject(map.socket, "lines["+fpUtils.quoteJavaScript(line.id)+"]", "line", function() {
						dialog.dismiss();
					});

					dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
				},
				addLine: function(type) {
					map.map.closePopup();

					map.socket.emit("getLineTemplate", { typeId: type.id }, function(err, line) {
						if(err)
							return map.messages.showMessage("danger", err);

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

							if(save && line.routePoints.length >= 2) {
								map.socket.emit("addLine", { routePoints: line.routePoints, typeId: type.id }, function(err, line) {
									if(err)
										return map.messages.showMessage("danger", err);

									linesUi.editLine(line);

									// We have to wait until the server sends us the trackPoints of the line
									var removeWatcher = map.socket.$watch(function() { return !!linesById[line.id]; }, function(exists) {
										if(exists) {
											linesById[line.id].openPopup();
											removeWatcher();
										}
									});
								});
							}
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
					});
				},
				moveLine: function(line) {
					var movable = linesUi._makeLineMovable(line);

					var message = map.messages.showMessage("info", "Drag the line points around to change it. Double-click a point to remove it.", [
						{ label: "Finish", click: done.bind(null, true) },
						{ label: "Cancel", click: done.bind(null, false) }
					], null, done.bind(null, false, true));

					map.map.closePopup();

					function done(save, noClose) {
						var newPoints = movable.done();
						linesUi._addLine(line);
						linesById[line.id].openPopup();

						if(!noClose) {
							message.close();
						}

						if(save) {
							line.trackPoints = { };
							map.socket.emit("editLine", { id: line.id, routePoints: newPoints }, function(err) {
								if(err)
									map.messages.showMessage("danger", err);
							});
						}
					}
				},
				deleteLine: function(line) {
					map.socket.emit("deleteLine", line, function(err) {
						if(err)
							map.messages.showMessage("danger", err);
					});
				}
			};

			return linesUi;
		};
	});

	fp.app.controller("fpMapLineEditCtrl", function($scope, map, line) {
		$scope.line = line;

		$scope.canControl = function(what) {
			return map.typesUi.canControl($scope.types[$scope.line.typeId], what);
		};

		$scope.save = function() {
			$scope.error = null;
			map.socket.emit("editLine", $scope.line, function(err) {
				if(err)
					return $scope.error = err;

				$scope.$close();
			});
		};

		$scope.$watchGroup([ "line.colour", "line.width" ], function() {
			map.linesUi._addLine($scope.line);
		});
	});

})(FacilPad, jQuery, angular);