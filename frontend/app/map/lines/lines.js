(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapLines", function(fpUtils, $uibModal, $templateCache, $compile, $timeout) {
		return function(map) {
			var ret = {
				renderLinePopup: function(line, el, callback) {
					var scope = map.socket.$new();

					scope.line = line;

					scope.edit = function() {
						ret.editLine(scope.line);
					};

					scope.move = function() {
						ret.moveLine(scope.line);
					};

					scope['delete'] = function() {
						ret.deleteLine(scope.line);
					};

					/*map.socket.$watch("lines["+fpUtils.quoteJavaScript(line.id)+"]", function(newVal) {
						if(newVal == null)
							scope.popup.close();
						else
							scope.line = newVal;
					});

					scope.$watch("line.routePoints", function(newVal, oldVal) {
						if(!ng.equals(oldVal, newVal))
							scope.popup.updatePosition(newVal[newVal.length-1]);
					}, true);*/

					el.html($templateCache.get("map/lines/view-line.html"));
					$compile(el[0])(scope);

					$timeout(function() { $timeout(callback); }); // $compile only replaces variables on next digest
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
					map.popups.closeAll();

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
						var unregister = null;

						function addPoint(pos) {
							line.routePoints.push(pos);
							line.trackPoints = [ ].concat(line.routePoints, [ pos ]); // Add pos a second time so that it gets overwritten by mouseMoveListener
							map.addLine(line);
							handler = map.addClickListener(mapClick);
						}

						function finishLine(save, noClose) {
							if(!noClose)
								message.close();

							unregister();
							handler && handler.cancel();
							map.deleteLine(line);

							if(save && line.routePoints.length >= 2) {
								map.socket.emit("addLine", { routePoints: line.routePoints, typeId: type.id }, function(err, line) {
									if(err)
										return map.messages.showMessage("danger", err);

									ret.viewLine(line);
									ret.editLine(line);
								});
							}
						}

						var mapClick = function(pos) {
							if(line.routePoints.length > 0 && pos.lon == line.routePoints[line.routePoints.length-1].lon && pos.lat == line.routePoints[line.routePoints.length-1].lat)
								finishLine(true);
							else
								addPoint(pos);
						};

						var mouseMove = function(e, pos) {
							if(line.trackPoints.length > 0) {
								line.trackPoints[line.trackPoints.length-1] = pos;
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
					], null, done.bind(null, false, true));

					map.popups.closeAll();

					function done(save, noClose) {
						var newPoints = movable.done();
						map.addLine(line);
						ret.viewLine(line);

						if(!save && !noClose) {
							message.close();
						}

						if(save) {
							line.trackPoints = { };
							map.socket.emit("editLine", { id: line.id, routePoints: newPoints }, function(err) {
								if(!noClose)
									message.close();

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

			return ret;
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
			map.addLine($scope.line);
		});
	});

})(FacilPad, jQuery, angular);