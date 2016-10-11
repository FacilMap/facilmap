(function(fp, $, ng, undefined) {

	// From http://stackoverflow.com/a/11277751/242365
	fp.app.factory("fpSocket", function($rootScope, fpUtils) {
		return function(padId) {
			var scope = $rootScope.$new();

			scope.padData = null;
			scope.readonly = null;
			scope.markers = { };
			scope.lines = { };
			scope.views = { };
			scope.types = { };

			var socket = io.connect(fp.SERVER, { 'force new connection': true });

			scope.on = function(eventName, fn) {
				if(fn)
					fn = fn.fpWrapApply(scope);

				return socket.on.apply(socket, [ eventName, fn ]);
		    };

			scope.removeListener = socket.removeListener.bind(socket);

			scope.emit = function(eventName, data, cb) {
				if(cb) {
					scope.$emit("loadStart");
					var cb2 = cb;
					arguments[2] = function() {
						scope.$emit("loadEnd");
						var context = this;
						var args = arguments;
						scope.$apply(function() {
							cb2.apply(context, args);
						});
					};
				}

				return socket.emit.apply(socket, arguments);
			};

			scope.on("serverError", function(data) {
				scope.serverError = data;
			});

			scope.on("padData", function(data) {
				scope.padData = data;

				if(data.writable != null)
					scope.readonly = !data.writable;

				var id = scope.readonly ? data.id : data.writeId;
				if(id != null)
					scope.padId = id;

				scope.disconnected = false;
			});

			scope.on("marker", function(data) {
				if(scope.markers[data.id] == null)
					scope.markers[data.id] = { };

				scope.markers[data.id] = data;
			});

			scope.on("deleteMarker", function(data) {
				delete scope.markers[data.id];
			});

			scope.on("line", function(data) {
				if(scope.lines[data.id])
					data.trackPoints = scope.lines[data.id].trackPoints;
				else
					scope.lines[data.id] = { };

				scope.lines[data.id] = data;
			});

			scope.on("deleteLine", function(data) {
				delete scope.lines[data.id];
			});

			scope.on("linePoints", function(data) {
				var line = scope.lines[data.id];
				if(line == null)
					return console.error("Received line points for non-existing line "+data.id+".");

				if(line.trackPoints == null || data.reset)
					line.trackPoints = { };

				for(var i=0; i<data.trackPoints.length; i++) {
					line.trackPoints[data.trackPoints[i].idx] = data.trackPoints[i];
				}

				line.trackPoints.length = 0;
				for(var i in line.trackPoints) {
					if(i != "length" && i >= line.trackPoints.length)
						line.trackPoints.length = 1*i+1;
				}
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
				scope.disconnected = true;
				scope.markers = { };
				scope.lines = { };
				scope.views = { };
			});

			scope.on("reconnect", function() {
				if(scope.padId)
					scope.emit("setPadId", scope.padId);
				else
					scope.disconnected = false; // Otherwise it gets set when padData arrives

				if(scope.bbox)
					scope.emit("updateBbox", scope.bbox);
			});

			scope.setPadId = function(padId) {
				if(scope.padId != null)
					return;

				scope.padId = padId;
				scope.emit("setPadId", padId);
			};

			scope.updateBbox = function(bbox) {
				scope.emit("updateBbox", bbox);

				scope.bbox = bbox;
			};

			if(padId)
				scope.setPadId(padId);

			scope.$on("$destroy", function() {
				socket.removeAllListeners();
				socket.disconnect();
			});

			return scope;
		};
	});

})(FacilPad, jQuery, angular);