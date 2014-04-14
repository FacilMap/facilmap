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

	facilpadApp.controller("PadCtrl", function($scope, socket, $timeout, $sce, $parse) {

		$("#toolbox").menu();
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
		$scope.padUrl = location.protocol + "//" + location.host + location.pathname;
		$scope.error = false;

		socket.emit("setPadId", location.pathname.match(/[^\/]*$/)[0]);

		bindSocketToScope($scope, socket);

		$scope.onMove = function() {
			if($scope.currentMarker)
				$scope.currentMarker.xy = fp.posToXy($scope.currentMarker.position);
			if($scope.currentLine && $scope.currentLine.clickPos)
				$scope.currentLine.clickXy = fp.posToXy($scope.currentLine.clickPos);
		};

		fp.onMove = wrapApply($scope, $scope.onMove);

		$scope.$watch("markers[currentMarker.id]", function() {
			if($scope.currentMarker != null)
				$scope.currentMarker = $scope.markers[$scope.currentMarker.id];
		});

		$scope.$watch("currentMarker", function() {
			$scope.onMove();
		});

		$scope.$watch("currentMarker.style", function() {
			if($scope.currentMarker != null)
				fp.addMarker($scope.currentMarker);
		});

		$scope.$watch("lines[currentLine.id]", function() {
			if($scope.currentLine != null)
				$scope.currentLine = $.extend($scope.lines[$scope.currentLine.id], { clickPos : $scope.currentLine.clickPos, clickXy : $scope.currentLine.clickXy });
		});

		$scope.$watch("currentLine.actualPoints.length", function() {
			// For drawing
			if($scope.currentLine != null)
				fp.addLine($scope.currentLine);
		});

		fp.onMoveEnd = function(bbox) {
			socket.emit("updateBbox", bbox);
		};

		$scope.$watch("padData", function(newValue) {
			if(newValue == null || $scope.loaded)
				return;

			$scope.loaded = true;
			setTimeout(function() { // Avoid error with onMove being executed while inside $apply()
				FacilPad.displayView(newValue.defaultView);
			}, 0);
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

		fp.onClickMarker = wrapApply($scope, function(marker) {
			$scope.currentLine = null;
			if($scope.currentMarker && $scope.currentMarker.id == marker.id)
				$scope.currentMarker = null;
			else
				$scope.currentMarker = marker;
		});

		fp.onClickLine = function(line, clickPos) {
			$scope.currentMarker = null;
			$scope.currentLine = line;
			$scope.currentLine.clickPos = clickPos;
			$scope.onMove();
		}.fpWrapApply($scope);

		$scope.addMarker = function() {
			var message = $scope.showMessage("info", "Please click on the map to add a marker.");
			fp.addClickListener(function(pos) {
				$scope.$apply(function() {
					$scope.closeMessage(message);

					socket.emit("addMarker", { position: { lon: pos.lon, lat: pos.lat } }, function(err, marker) {
						if(err)
							return $scope.showMessage("error", err);

						$scope.currentMarker = marker;
						$scope.openDialog("edit-marker-dialog");
					});
				});
			});
		};

		$scope.saveMarker = function(marker) {
			socket.emit("editMarker", marker, function(err) {
				if(err)
					$scope.dialogError = err;
				else
					$scope.closeDialog();
			})
		};

		$scope.deleteMarker = function(marker) {
			socket.emit("deleteMarker", marker, function(err) {
				if(err)
					$scope.showMessage("error", err);
			});
		};

		$scope.addLine = function() {
			socket.emit("addLine", { points: [ ] }, function(err, line) {
				$scope.currentLine = line;
				var message = $scope.showMessage("info", "Please click on the map to draw a line. Double-click to finish it.");

				var lastPos = null;
				var clickListener = function(pos) {
					if(lastPos && pos.lon == lastPos.lon && pos.lat == lastPos.lat) {
						$scope.closeMessage(message);

						// Finish drawing
						socket.emit("editLine", { id: line.id, points: line.points }, function(err, line) {
							if(err)
								return $scope.showMessage("error", err);

							$scope.currentLine = line;
							$scope.openDialog("edit-line-dialog");
						});
					} else {
						line.points.push(pos);
						line.actualPoints.push(pos);
						fp.addClickListener(clickListener);
						lastPos = pos;
					}
				}.fpWrapApply($scope);

				fp.addClickListener(clickListener);
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

		$scope.deleteLine = function(line) {
			socket.emit("deleteLine", line, function(err) {
				if(err)
					$scope.showMessage("error", err);
			});
		};

		$scope.displayView = function(view) {
			fp.displayView(view);
		};

		$scope.saveView = function() {
			var view = fp.getCurrentView();
			view.name = $scope.saveViewName;
			socket.emit("addView", view, function(err) {
				if(err)
					$scope.dialogError = err;
				else
					$scope.closeDialog();
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

		$scope.showMessage = function(type, message, lifetime) {
			var messageObj = {
				type: type,
				message: message
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
		}
	});

	function bindSocketToScope($scope, socket) {
		socket.on("padData", function(data) {
			$scope.padData = data;
		});

		socket.on("marker", function(data) {
			$scope.markers[data.id] = data;

			fp.addMarker(data);
		});

		socket.on("deleteMarker", function(data) {
			delete $scope.markers[data.id];

			if($scope.currentMarker && $scope.currentMarker.id == data.id && $scope.dialog && $scope.dialog.attr("id") == "edit-marker-dialog") {
				$scope.currentMarker = null;
				$scope.closeDialog();
			}

			fp.deleteMarker(data);
		});

		socket.on("line", function(data) {
			$scope.lines[data.id] = data;

			fp.addLine(data);
		});

		socket.on("deleteLine", function(data) {
			delete $scope.lines[data.id];

			if($scope.currentLine && $scope.currentLine.id == data.id && $scope.dialog && $scope.dialog.attr("id") == "edit-line-dialog") {
				$scope.currentLine = null;
				$scope.closeDialog();
			}

			fp.deleteLine(data);
		});

		socket.on("view", function(data) {
			$scope.views[data.id] = data;
		});

		socket.on("deleteView", function(data) {
			delete $scope.views[data.id];
		});

		socket.on("disconnect", function() {
			$scope.error = true;

			$scope.showMessage("error", "The connection to the server was lost.");
		})
	}

	$(function() {
		ng.bootstrap(document, [ "facilpad" ]);
	});

})(FacilPad, jQuery, angular);