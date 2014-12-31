(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapLines", [ "fpUtils", "fpDialogs", function(fpUtils, fpDialogs) {
		return function(map) {
			var ret = {
				viewLine: function(line, clickPos) {
					if(clickPos == null)
						clickPos = line.points[line.points.length-1];

					var scope = map.socket.$new();

					scope.line = line;
					scope.popup = map.popups.open("view-line.html", scope, clickPos);

					scope.edit = function() {
						ret.editLine(line);
					};

					scope.move = function() {
						ret.moveLine(line);
					};

					scope['delete'] = function() {
						ret.deleteLine(line);
					};

					map.socket.$watch("lines["+fpUtils.quoteJavaScript(line.id)+"]", function(newVal) {
						if(newVal == null)
							scope.popup.close();
						else
							scope.line = newVal;
					});
				},
				editLine: function(line) {
					var scope = map.socket.$new();

					scope.line = line; // In case it is not in global line list yet
					var preserve = fpUtils.preserveObject(scope, "lines["+fpUtils.quoteJavaScript(line.id)+"]", "line", function() {
						scope.dialog.close(false);
					});

					scope.dialog = fpDialogs.open("edit-line.html", scope, "Edit Line", preserve.revert.bind(preserve));

					scope.canControl = function(what) {
						return map.typesUi.canControl(scope.types[line.typeId], what);
					};

					scope.save = function() {
						scope.error = null;
						map.socket.emit("editLine", scope.line, function(err) {
							if(err)
								return scope.error = err;

							scope.dialog.close(false);
						});
					};

					scope.$watchGroup([ "line.colour", "line.width" ], function() {
						map.addLine(scope.line);
					});
				},
				addLine: function(type) {
					map.socket.emit("getLineTemplate", { typeId: type.id }, function(err, line) {
						if(err)
							return map.messages.showMessage("error", err);

						line.points = [ ];
						line.actualPoints = [ ];
						var message = map.messages.showMessage("info", "Please click on the map to draw a line. Double-click to finish it.", [
							{ label: "Finish", click: finishLine.bind(null, true) },
							{ label: "Cancel", click: finishLine.bind(null, false) }
						]);

						var handler = null;
						var unregister = null;

						function addPoint(pos) {
							line.points.push(pos);
							line.actualPoints = [ ].concat(line.points, [ pos ]); // Add pos a second time so that it gets overwritten by mouseMoveListener
							map.addLine(line);
							handler = map.addClickListener(mapClick);
						}

						function finishLine(save) {
							message.close();
							unregister();
							handler && handler.cancel();
							map.deleteLine(line);

							if(save && line.points.length >= 2) {
								map.socket.emit("addLine", { points: line.points, typeId: type.id }, function(err, line) {
									if(err)
										return map.messages.showMessage("error", err);

									ret.viewLine(line);
									ret.editLine(line);
								});
							}
						}

						var mapClick = function(pos) {
							if(line.points.length > 0 && pos.lon == line.points[line.points.length-1].lon && pos.lat == line.points[line.points.length-1].lat)
								finishLine(true);
							else
								addPoint(pos);
						};

						var mouseMove = function(e, pos) {
							if(line.actualPoints.length > 0) {
								line.actualPoints[line.actualPoints.length-1] = pos;
								map.addLine(line);
							}
						};

						handler = map.addClickListener(mapClick);
						unregister = map.mapEvents.$on("mouseMove", mouseMove);
					});
				},
				moveLine: function(line) {
					var movable = map.makeLineMovable(line);

					var message = map.messages.showMessage("info", "Drag the line points around to change it. Double-click a point to remove it.", [
						{ label: "Finish", click: done.bind(null, true) },
						{ label: "Cancel", click: done.bind(null, false) }
					]);

					function done(save) {
						var newPoints = movable.done();
						map.addLine(line);

						if(!save) {
							message.close();
						}

						if(save) {
							line.actualPoints = { };
							map.socket.emit("editLine", { id: line.id, points: newPoints }, function(err) {
								message.close();

								if(err)
									map.messages.showMessage("error", err);
							});
						}
					}
				},
				deleteLine: function(line) {
					map.socket.emit("deleteLine", line, function(err) {
						if(err)
							map.messages.showMessage("error", err);
					});
				}
			};

			map.mapEvents.$on("clickLine", function(e, line, clickPos, evt) {
				var one = false;
				map.popups.getOpenPopups().forEach(function(popup) {
					if(popup.template == "view-line.html" && popup.scope.line.id == line.id) {
						popup.close();
						if(popup.pos.lon == clickPos.lon && popup.pos.lat == clickPos.lat)
							one = true;
					}
				});
				if(one)
					return;

				if(!evt.ctrlKey && !evt.shiftKey)
					map.popups.closeAll();

				map.linesUi.viewLine(line, clickPos);
			});

			return ret;
		};
	} ]);

})(FacilPad, jQuery, angular);