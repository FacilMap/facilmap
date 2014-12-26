(function(fp, $, ng, undefined) {

	// From http://stackoverflow.com/a/11277751/242365
	fp.app.factory("fpSocket", [ "$rootScope", "fpUtils", function($rootScope, fpUtils) {
		return function(map, padId) {
			var scope = $rootScope.$new();

			scope.padData = null;
			scope.readonly = null;
			scope.markers = { };
			scope.lines = { };
			scope.views = { };
			scope.types = { };

			var socket = io.connect(fp.SERVER);

			scope.on = function(eventName, fn) {
				if(fn)
					fn = fn.fpWrapApply(scope);

				return socket.on.apply(socket, [ eventName, fn ]);
		    };

			scope.emit = function(eventName, data, cb) {
				if(cb) {
					map.loadStart();
					var cb2 = cb;
					arguments[2] = function() {
						map.loadEnd();
						var context = this;
						var args = arguments;
						scope.$apply(function() {
							cb2.apply(context, args);
						});
					};
				}

				return socket.emit.apply(socket, arguments);
			};

			scope.on("padData", function(data) {
				scope.padData = data;

				if(data.writable != null)
					scope.readonly = !data.writable;

				if(scope.error) {
					scope.error.close();
					scope.error = null;
				}

				if(!scope.loaded) {
					scope.loaded = true;
					map.displayView(data.defaultView);
				}
			});

			scope.on("marker", function(data) {
				if(scope.markers[data.id] == null)
					scope.markers[data.id] = { };

				scope.markers[data.id] = data;

				map.addMarker(data);
			});

			scope.on("deleteMarker", function(data) {
				delete scope.markers[data.id];

				map.deleteMarker(data);
			});

			scope.on("line", function(data) {
				if(scope.lines[data.id]) {
					data.actualPoints = scope.lines[data.id].actualPoints;
					data.clickPos = scope.lines[data.id].clickPos;
					data.clickXy = scope.lines[data.id].clickXy;
				}
				else
					scope.lines[data.id] = { };

				scope.lines[data.id] = data;

				map.addLine(scope.lines[data.id]);
			});

			scope.on("deleteLine", function(data) {
				delete scope.lines[data.id];

				map.deleteLine(data);
			});

			scope.on("linePoints", function(data) {
				var line = scope.lines[data.id];
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
						line.actualPoints.length = 1*i+1;
				}

				map.addLine(scope.lines[data.id]);
			});

			scope.on("view", function(data) {
				if(scope.views[data.id] == null)
					scope.views[data.id] = { };

				scope.views[data.id] = data;
			});

			scope.on("deleteView", function(data) {
				delete scope.views[data.id];
				if(scope.padData.defaultViewId == data.id)
					scope.padData.defaultViewId = null;
			});

			scope.on("type", function(data) {
				if(scope.types[data.id] == null)
					scope.types[data.id] = { };

				scope.types[data.id] = data;
			});

			scope.on("deleteType", function(data) {
				delete scope.types[data.id];
			});

			scope.on("disconnect", function() {
				scope.error = map.messages.showMessage("error", "The connection to the server was lost.");
				scope.markers = { };
				scope.lines = { };
				scope.views = { };
			});

			scope.on("reconnect", function() {
				scope.emit("setPadId", scope.padId);
				scope.emit("updateBbox", scope.bbox);
			});

			map.mapEvents.$on("moveEnd", function(e, bbox) {
				scope.emit("updateBbox", bbox);

				scope.$apply(function() {
					scope.bbox = bbox;
				});
			});

			scope.emit("setPadId", padId);

			return scope;
		};
	} ]);

})(FacilPad, jQuery, angular);