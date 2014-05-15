(function(fp, $, ng, undefined) {

	var facilpadApp = angular.module("facilpad", [ ]);

	function wrapApply($scope, f) {
		return function() {
			var context = this;
			var args = arguments;
			$scope.$apply(function() {
				f.apply(context, args);
			});
		}
	}

	Function.prototype.fpWrapApply = function($scope) {
		return wrapApply($scope, this);
	};

	// From http://stackoverflow.com/a/11277751/242365
	facilpadApp.factory("socket", function($rootScope) {
		var socket = io.connect(fp.SERVER);

		var onBkp = socket.on;
		socket.on = function(eventName, fn) {
			if(fn)
				arguments[1] = wrapApply($rootScope, fn);
			onBkp.apply(this, [ eventName, fn ]);
	    };
		var emitBkp = socket.emit;
		socket.emit = function(eventName, data, cb) {
			if(cb)
				arguments[2] = wrapApply($rootScope, cb);
			emitBkp.apply(this, arguments);
		};

		return socket;
	});

	facilpadApp.directive("fpDialog", function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				$(element).dialog({ autoOpen: false, modal: true, height: "auto", width: 600 });
			}
		}
	});

	facilpadApp.directive("fpSpinner", function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				$(element).spinner();
			}
		}
	});

	facilpadApp.directive("fpColourPicker", function() {
		var colourPicker = $("#colour-picker").hide();

		function textColour(colour) {
			var r = parseInt(colour.substr(0, 2), 16)/255;
			var g = parseInt(colour.substr(2, 2), 16)/255;
			var b = parseInt(colour.substr(4, 2), 16)/255;
			// See http://stackoverflow.com/a/596243/242365
			return (Math.sqrt(0.241*r*r + 0.691*g*g + 0.068*b*b) <= 0.5) ? "ffffff" : "000000";
		}

		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				scope.$watch(attrs.ngModel, function(v) {
					var colour = (v && v.match(/^[0-9a-f]{6}$/i) ? v : 'ffffff');
					element.css({ 'background-color': '#' + colour, 'color' : '#' + textColour(colour)});
				});

				var handler = function(e) {
					var target = $(e.target);
					if(target.is("#colour-picker li")) {
						element.val(target.attr("data-colour"));
						element.triggerHandler("input");
					}
					if(!target.is("#colour-picker") && !$(document.activeElement).is(element)) {
						colourPicker.hide();
						$(document).off("click keyup", handler);
					}
				};

				$(element).focus(function() {
					var link = $(this);
					var pos = link.offset();
					colourPicker.show().offset({
						top: pos.top + link.outerHeight(),
						left: pos.left
					});

					$(document).on("click keyup", handler);
				});
			}
		}
	});

	facilpadApp.directive("fpPopup", function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				var el = $(element);

				el.addClass("fp-popup fp-popup-hidden fp-popup-bottom fp-popup-right");

				scope.$watchCollection(attrs.fpPopup, function(v) {
					if(v == null)
						el.addClass("fp-popup-hidden");
					else {
						el.removeClass("fp-popup-hidden").css({ top: v.y + 'px', left: v.x + 'px' });

						var vpDim = { width: $(window).width(), height: $(window).height() };

						if(el.hasClass("fp-popup-bottom") && v.y + el.outerHeight(true) > vpDim.height)
							el.removeClass("fp-popup-bottom").addClass("fp-popup-top");
						if(el.hasClass("fp-popup-top") && v.y + parseInt(el.css("margin-top")) < 0)
							el.removeClass("fp-popup-top").addClass("fp-popup-bottom");

						if(el.hasClass("fp-popup-left") && v.x + parseInt(el.css("margin-left")) < 0)
							el.removeClass("fp-popup-left").addClass("fp-popup-right");
						if(el.hasClass("fp-popup-right") && v.x + el.outerWidth(true) > vpDim.width)
							el.removeClass("fp-popup-right").addClass("fp-popup-left");
					}
				});
			}
		};
	});

	facilpadApp.directive("fpTitle", function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				if(!$(element).is("title"))
					return;

				scope.$watch(attrs.fpTitle, function(v) {
					// We have to call history.replaceState() in order for the new title to end up in the browser history
					window.history && history.replaceState({ }, v);
					document.title = v;
				});
			}
		};
	});

	facilpadApp.controller("PadCtrl", function($scope, socket, $timeout, $sce, $parse) {

		setTimeout(function() { $("#toolbox").menu(); }, 0);
		function updateMenu() {
			setTimeout(function() { $("#toolbox").menu("destroy").menu(); }, 0);
		}

		$scope.padData = null;
		$scope.loaded = false;
		$scope.markers = { };
		$scope.lines = { };
		$scope.views = { };
		$scope.dialog = null;
		$scope.dialogError = null;
		$scope.saveViewName = null;
		$scope.currentMarker = null;
		$scope.currentLine = null;
		$scope.messages = [ ];
		$scope.urlPrefix = location.protocol + "//" + location.host + location.pathname.replace(/[^\/]*$/, "");
		$scope.padId = fp.padId;
		$scope.error = null;
		$scope.bbox = null;
		$scope.layers = fp.getLayerInfo();
		$scope.colours = fp.COLOURS;
		$scope.readonly = null;

		socket.emit("setPadId", FacilPad.padId);

		bindSocketToScope($scope, socket);

		$scope.onMove = function() {
			if($scope.currentMarker)
				$scope.currentMarker.xy = fp.posToXy($scope.currentMarker.position);
			if($scope.currentLine && $scope.currentLine.clickPos)
				$scope.currentLine.clickXy = fp.posToXy($scope.currentLine.clickPos);
		};

		fp.mapEvents.on("move", $scope.onMove.fpWrapApply($scope));

		$scope.$watch("markers[currentMarker.id]", function() {
			if($scope.currentMarker != null)
				$scope.currentMarker = $scope.markers[$scope.currentMarker.id];
		});

		$scope.$watch("currentMarker", function() {
			$scope.onMove();

			if($scope.currentMarker == null && $scope.dialog && $scope.dialog.attr("id") == "edit-marker-dialog")
				$scope.closeDialog();
		});

		$scope.$watch("currentMarker.style", function() {
			if($scope.currentMarker != null)
				fp.addMarker($scope.currentMarker);
		});

		$scope.$watch("lines[currentLine.id]", function() {
			if($scope.currentLine != null)
				$scope.currentLine = $scope.lines[$scope.currentLine.id];
		});

		$scope.$watch("currentLine", function() {
			if($scope.currentLine == null && $scope.dialog && $scope.dialog.attr("id") == "edit-line-dialog")
				$scope.closeDialog();
		});

		$scope.$watch("layers", function() {
			updateMenu();
		});

		fp.mapEvents.on("moveEnd", function(e, bbox) {
			socket.emit("updateBbox", bbox);

			$scope.$apply(function() {
				$scope.bbox = bbox;
			});
		});

		$scope.$watch("padData", function(newValue) {
			if($scope.error) {
				$scope.closeMessage($scope.error);
				$scope.error = null;
			}

			if(newValue == null || $scope.loaded)
				return;

			$scope.loaded = true;
			FacilPad.displayView(newValue.defaultView);
		});

		$scope.$watch("currentMarker", function() {
			if($scope.currentMarker != null)
				$scope.currentMarker.descriptionHtml = $scope.marked($scope.currentMarker.description);
		});

		$scope.$watch("currentMarker.description", function() {
			if($scope.currentMarker != null)
				$scope.currentMarker.descriptionHtml = $scope.marked($scope.currentMarker.description);
		});

		$scope.$watch("currentLine", function() {
			if($scope.currentLine != null)
				$scope.currentLine.descriptionHtml = $scope.marked($scope.currentLine.description);
		});

		$scope.$watch("currentLine.description", function() {
			if($scope.currentLine != null)
				$scope.currentLine.descriptionHtml = $scope.marked($scope.currentLine.description);
		});

		$scope.$watch("views", updateMenu);

		$scope.marked = function(text) {
			return text != null ? $sce.trustAsHtml(marked(text)) : null;
		};

		$scope.savePadData = function() {
			var padData = $.extend({ }, $scope.padData);
			delete padData.defaultView;
			socket.emit("editPad", padData, function(err) {
				if(err)
					$scope.dialogError = err;
				else
					$scope.closeDialog();
			});
		};

		fp.mapEvents.on("clickMarker", function(e, marker) {
			$scope.currentLine = null;
			if($scope.currentMarker && $scope.currentMarker.id == marker.id)
				$scope.currentMarker = null;
			else
				$scope.currentMarker = marker;
		}.fpWrapApply($scope));

		fp.mapEvents.on("clickLine", function(e, line, clickPos) {
			$scope.currentMarker = null;
			$scope.currentLine = line;
			$scope.currentLine.clickPos = clickPos;
			$scope.onMove();
		}.fpWrapApply($scope));

		$scope.addMarker = function() {
			var message = $scope.showMessage("info", "Please click on the map to add a marker.", [
				{ label: "Cancel", click: function() {
					$scope.closeMessage(message);
					listener.cancel();
				}}
			]);
			var listener = fp.addClickListener(function(pos) {
				$scope.closeMessage(message);

				socket.emit("addMarker", { position: { lon: pos.lon, lat: pos.lat } }, function(err, marker) {
					if(err)
						return $scope.showMessage("error", err);

					$scope.currentMarker = marker;
					$scope.openDialog("edit-marker-dialog");
				});
			}.fpWrapApply($scope));
		};

		$scope.saveMarker = function(marker) {
			socket.emit("editMarker", marker, function(err) {
				if(err)
					$scope.dialogError = err;
				else
					$scope.closeDialog();
			})
		};

		$scope.moveMarker = function(marker) {
			var message = $scope.showMessage("info", "Click somewhere on the map to reposition the marker there.", [
				{ label: "Cancel", click: function() {
					$scope.closeMessage(message);
					listener.cancel();
				}}
			]);

			$scope.currentMarker = null;

			var listener = fp.addClickListener(function(pos) {
				$scope.closeMessage(message);

				socket.emit("editMarker", { id: marker.id, position: pos }, function(err) {
					if(err)
						return $scope.showMessage("error", err);

					$scope.currentMarker = $scope.markers[marker.id];
				});
			});
		};

		$scope.deleteMarker = function(marker) {
			socket.emit("deleteMarker", marker, function(err) {
				if(err)
					$scope.showMessage("error", err);
			});
		};

		$scope.addLine = function() {
			socket.emit("addLine", { points: [ ] }, function(err, line) {
				line.actualPoints = [ ];
				$scope.currentLine = line;
				var message = $scope.showMessage("info", "Please click on the map to draw a line. Double-click to finish it.", [
					{ label: "Finish", click: finishLine.bind(null, true) },
					{ label: "Cancel", click: finishLine.bind(null, false) }
				]);

				var handler = null;

				function addPoint(pos) {
					line.points.push(pos);
					line.actualPoints = [ ].concat(line.points, [ pos ]); // Add pos a second time so that it gets overwritten by mouseMoveListener
					fp.addLine(line);
					handler = fp.addClickListener(mapClick);
				}

				function finishLine(save) {
					$scope.closeMessage(message);
					fp.mapEvents.off("mouseMove", mouseMove);
					handler && handler.cancel();

					if(save && line.points.length >= 2) {
						socket.emit("editLine", { id: line.id, points: line.points }, function(err, line) {
							if(err)
								return $scope.showMessage("error", err);

							$scope.currentLine.clickPos = line.points[line.points.length-1];
							$scope.onMove();
							$scope.openDialog("edit-line-dialog");
						});
					} else {
						socket.emit("deleteLine", { id: line.id }, function(err) {
							if(err)
								return $scope.showMessage("error", err);
						});
					}
				}

				var mapClick = function(pos) {
					if(line.points.length > 0 && pos.lon == line.points[line.points.length-1].lon && pos.lat == line.points[line.points.length-1].lat)
						finishLine(true);
					else
						addPoint(pos);
				}.fpWrapApply($scope);

				var mouseMove = function(e, pos) {
					if(line.actualPoints.length > 0) {
						line.actualPoints[line.actualPoints.length-1] = pos;
						fp.addLine(line);
					}
				}.fpWrapApply($scope);

				handler = fp.addClickListener(mapClick);
				fp.mapEvents.on("mouseMove", mouseMove);
			});
		};

		$scope.saveLine = function(line) {
			socket.emit("editLine", line, function(err) {
				if(err)
					$scope.dialogError = err;
				else
					$scope.closeDialog();
			})
		};

		$scope.moveLine = function(line) {
			$scope.currentLine = null;

			var pointsBkp = [ ].concat(line.points);
			var actualPointsBkp = $.extend({ }, line.actualPoints);
			var movable = fp.makeLineMovable(line);

			var message = $scope.showMessage("info", "Drag the line points around to change it. Double-click a point to remove it.", [
				{ label: "Finish", click: function() {
					movable.done();

					line.actualPoints = { };
					socket.emit("editLine", { id: line.id, points: line.points }, function(err) {
						if(err)
							$scope.showMessage("error", err);

						$scope.closeMessage(message);
					});
				}},
				{ label: "Cancel", click: function() {
					$scope.closeMessage(message);
					movable.done();

					line.points = pointsBkp;
					line.actualPoints = actualPointsBkp;
					fp.addLine(line);
				}}
			]);
		};

		$scope.deleteLine = function(line) {
			socket.emit("deleteLine", line, function(err) {
				if(err)
					$scope.showMessage("error", err);
			});
		};

		$scope.displayView = function(view) {
			fp.displayView(view);
		};

		$scope.saveView = function(makeDefault) {
			var view = fp.getCurrentView();
			view.name = $scope.saveViewName;
			socket.emit("addView", view, function(err, view) {
				if(err)
					return $scope.dialogError = err;

				if(makeDefault) {
					socket.emit("editPad", { defaultView: view.id }, function(err) {
						if(err)
							return $scope.dialogError = err;

						$scope.saveViewName = null;
						$scope.closeDialog();
					});
				} else {
					$scope.saveViewName = null;
					$scope.closeDialog();
				}
			});
		};

		$scope.setDefaultView = function(view) {
			socket.emit("editPad", { defaultView: view.id }, function(err) {
				if(err)
					$scope.dialogError = err;
			});
		};

		$scope.deleteView = function(view) {
			socket.emit("deleteView", { id: view.id }, function(err) {
				if(err)
					$scope.dialogError = err;
			});
		};

		$scope.openDialog = function(id) {
			var el = $("#"+id);

			var preserve = el.attr("fp-preserve");
			if(preserve)
				$scope.dialogBkp = angular.copy($parse(preserve)($scope));

			$scope.dialog = el.dialog("open").bind("dialogclose", wrapApply($scope, function() {
				$scope.dialog = null;
				$scope.dialogError = null;

				if(preserve && $scope.dialogBkp !== undefined) // undefined is set in closeDialog()
					$parse(preserve + " = fpPreserveRestore")($scope, { fpPreserveRestore: $scope.dialogBkp });
			}));
		};

		$scope.closeDialog = function(restorePreserved) {
			if(!restorePreserved)
				$scope.dialogBkp = undefined;

			setTimeout(function() { // dialogclose event handler calls $apply
				$scope.dialog.dialog("close");
			}, 0);
		};

		$scope.showMessage = function(type, message, buttons, lifetime) {
			var messageObj = {
				type: type,
				message: message,
				buttons: buttons
			};
			$scope.messages.push(messageObj);

			if(lifetime) {
				$timeout(function() {
					$scope.closeMessage(messageObj);
				}, lifetime);
			}

			return messageObj;
		};

		$scope.closeMessage = function(message) {
			var idx = $scope.messages.indexOf(message);
			if(idx == -1)
				return;

			$scope.messages = $scope.messages.slice(0, idx).concat($scope.messages.slice(idx+1));
		};

		$scope.round = function(number, digits) {
			var fac = Math.pow(10, digits);
			return Math.round(number*fac)/fac;
		};

		$scope.formatTime = function(seconds) {
			var hours = Math.floor(seconds/3600);
			var minutes = Math.floor((seconds%3600)/60);
			if(minutes < 10)
				minutes = "0" + minutes;
			return hours + ":" + minutes;
		};

		$scope.routingMode = function(mode) {
			switch(mode) {
				case "fastest":
				case "shortest":
					return " by car";
				case "bicycle":
					return " by bicycle";
				case "pedestrian":
					return " by foot";
				default:
					return "";
			}
		};

		$scope.setLayer = function(layer) {
			fp.showLayer(layer.permalinkName, !layer.visibility);
			$scope.layers = fp.getLayerInfo();
		};
	});

	function bindSocketToScope($scope, socket) {
		socket.on("padData", function(data) {
			$scope.padData = data;

			if(data.writable != null)
				$scope.readonly = !data.writable;
		});

		socket.on("marker", function(data) {
			$scope.markers[data.id] = data;

			fp.addMarker(data);
		});

		socket.on("deleteMarker", function(data) {
			delete $scope.markers[data.id];

			fp.deleteMarker(data);
		});

		socket.on("line", function(data) {
			if($scope.lines[data.id]) {
				data.actualPoints = $scope.lines[data.id].actualPoints;
				data.clickPos = $scope.lines[data.id].clickPos;
				data.clickXy = $scope.lines[data.id].clickXy;
			}

			$scope.lines[data.id] = data;

			fp.addLine(data);
		});

		socket.on("deleteLine", function(data) {
			delete $scope.lines[data.id];

			fp.deleteLine(data);
		});

		socket.on("linePoints", function(data) {
			var line = $scope.lines[data.id];
			if(line == null)
				return console.error("Received line points for non-existing line "+data.id+".");

			if(line.actualPoints == null || data.reset)
				line.actualPoints = { };

			for(var i=0; i<data.points.length; i++) {
				line.actualPoints[data.points[i].idx] = data.points[i];
			}

			line.actualPoints.length = 0;
			for(var i in line.actualPoints) {
				if(i != "length" && i >= line.actualPoints.length)
					line.actualPoints.length = i+1;
			}

			fp.addLine(line);
		});

		socket.on("view", function(data) {
			$scope.views[data.id] = data;
		});

		socket.on("deleteView", function(data) {
			delete $scope.views[data.id];
		});

		socket.on("disconnect", function() {
			$scope.error = $scope.showMessage("error", "The connection to the server was lost.");
			$scope.markers = { };
			$scope.lines = { };
			$scope.views = { };
		});

		socket.on("reconnect", function() {
			socket.emit("setPadId", FacilPad.padId);
			socket.emit("updateBbox", $scope.bbox);
		});
	}

	$(function() {
		ng.bootstrap(document, [ "facilpad" ]);
	});

})(FacilPad, jQuery, angular);