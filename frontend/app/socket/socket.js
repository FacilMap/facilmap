import fm from '../app';
import $ from 'jquery';

// From http://stackoverflow.com/a/11277751/242365
fm.app.factory("fmSocket", function($rootScope, $q, fmFilter) {
	return function(padId) {
		var socket = io.connect(fm.SERVER, { 'force new connection': true });

		var listeners = [ ];

		var fmSocket = $rootScope.$new();
		$.extend(fmSocket, {
			padData: null,
			readonly: null,
			markers: { },
			lines: { },
			views: { },
			types: { },
			history: { },
			filterExpr: null,
			filterFunc: fmFilter.compileExpression(null),

			on : function(eventName, fn) {
				if(typeof listeners[eventName] != "object") {
					listeners[eventName] = [ ];
					socket.on(eventName, simulateEvent.bind(null, eventName).fmWrapApply(fmSocket));
				}

				listeners[eventName].push(fn);
		    },

			removeListener: socket.removeListener.bind(socket),

			emit: function(eventName, data) {
				return $q(function(resolve, reject) {
					fmSocket.$emit("loadStart");

					socket.emit(eventName, data, function(err, data) {
						fmSocket.$emit("loadEnd");

						if(err)
							reject(err);
						else
							resolve(data);
					});
				});
			},

			setPadId: function(padId) {
				if(fmSocket.padId != null)
					return;

				return setPadId(padId);
			},

			updateBbox : function(bbox) {
				fmSocket.bbox = bbox;
				return fmSocket.emit("updateBbox", bbox).then(function(obj) {
					receiveMultiple(obj);
				});
			},

			createPad: function(data) {
				return fmSocket.emit("createPad", data).then(function(obj) {
					receiveMultiple(obj);
				});
			},

			setFilter: function(filter) {
				fmSocket.filterExpr = filter && filter.trim();

				var filterFunc = fmFilter.compileExpression(filter);
				fmSocket.filterFunc = function(obj, doNotPrepare) {
					if(!doNotPrepare)
						obj = fmFilter.prepareObject(obj, obj ? fmSocket.types[obj.typeId] : null);
					return filterFunc(obj);
				};

				simulateEvent("filter");
			},

			listenToHistory: function() {
				return fmSocket.emit("listenToHistory").then(function(obj) {
					fmSocket.listeningToHistory = true;
					receiveMultiple(obj);
				});
			},

			stopListeningToHistory: function() {
				fmSocket.listeningToHistory = false;
				return fmSocket.emit("stopListeningToHistory");
			},

			revertHistoryEntry: function(data) {
				return fmSocket.emit("revertHistoryEntry", data).then(function(obj) {
					fmSocket.history = { };
					receiveMultiple(obj);
				});
			}
		});

		var handlers = {
			padData: function(data) {
				setPadData(data);
			},

			marker: function(data) {
				if(fmSocket.markers[data.id] == null)
					fmSocket.markers[data.id] = { };

				fmSocket.markers[data.id] = data;
			},

			deleteMarker: function(data) {
				delete fmSocket.markers[data.id];
			},

			line: function(data) {
				if(fmSocket.lines[data.id])
					data.trackPoints = fmSocket.lines[data.id].trackPoints;
				else
					fmSocket.lines[data.id] = { };

				fmSocket.lines[data.id] = data;
			},

			deleteLine: function(data) {
				delete fmSocket.lines[data.id];
			},

			linePoints: function(data) {
				var line = fmSocket.lines[data.id];
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
			},

			view: function(data) {
				if(fmSocket.views[data.id] == null)
					fmSocket.views[data.id] = { };

				fmSocket.views[data.id] = data;
			},

			deleteView: function(data) {
				delete fmSocket.views[data.id];
				if(fmSocket.padData.defaultViewId == data.id)
					fmSocket.padData.defaultViewId = null;
			},

			type: function(data) {
				if(fmSocket.types[data.id] == null)
					fmSocket.types[data.id] = { };

				fmSocket.types[data.id] = data;
			},

			deleteType: function(data) {
				delete fmSocket.types[data.id];
			},

			disconnect: function() {
				fmSocket.disconnected = true;
				fmSocket.markers = { };
				fmSocket.lines = { };
				fmSocket.views = { };
				fmSocket.history = { };
			},

			connect: function() {
				if(fmSocket.padId)
					setPadId(fmSocket.padId);
				else
					fmSocket.disconnected = false; // Otherwise it gets set when padData arrives

				if(fmSocket.bbox)
					fmSocket.updateBbox(fmSocket.bbox);

				if(fmSocket.listeningToHistory) // TODO: Execute after setPadId() returns
					fmSocket.listenToHistory().catch(function(err) { console.error("Error listening to history", err); });
			},

			history: function(data) {
				fmSocket.history[data.id] = data;
				// TODO: Limit to 50 entries
			}
		};

		for(var i in handlers)
			fmSocket.on(i, handlers[i]);

		if(padId)
			fmSocket.padId = padId;

		fmSocket.$on("$destroy", function() {
			socket.removeAllListeners();
			socket.disconnect();
		});

		function setPadData(data) {
			fmSocket.padData = data;

			if(data.writable != null)
				fmSocket.readonly = !data.writable;

			var id = fmSocket.readonly ? data.id : data.writeId;
			if(id != null)
				fmSocket.padId = id;
		}

		function setPadId(padId) {
			fmSocket.padId = padId;
			return fmSocket.emit("setPadId", padId).then(function(obj) {
				fmSocket.disconnected = false;

				receiveMultiple(obj);
			}).catch(function(err) {
				fmSocket.serverError = err;
				socket.disconnect();
			});
		}

		function receiveMultiple(obj) {
			for(var i in obj || { })
				obj[i].forEach(simulateEvent.bind(null, i));
		}

		function simulateEvent(eventName, data) {
			if(typeof listeners[eventName] == "object") {
				listeners[eventName].forEach(function(listener) {
					listener(data);
				})
			}
		}

		return fmSocket;
	};
});
