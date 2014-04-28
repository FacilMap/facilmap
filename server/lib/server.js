var http = require("http");
var socketIo = require("socket.io");
var config = require("../config");
var listeners = require("./listeners");
var database = require("./database");
var domain = require("domain");
var utils = require("./utils");
var routing = require("./routing");

database.connect(function(err) {
	if(err)
		throw err;

	var app = http.createServer();
	app.listen(config.port, config.host);
	var io = socketIo.listen(app);

	io.sockets.on("connection", function(socket) {
		var d = domain.create();
		d.add(socket);

		var handlers = {
			error : function(err) {
				console.error("Error! Disconnecting client.");
				console.error(err.stack);
				socket.disconnect();
			},

			setPadId : function(padId) {
				if(socket.padId != null) {
					return;
				}

				socket.padId = padId;
				listeners.addPadListener(socket);

				database.getPadData(socket.padId, _sendData.bind(null, socket, "padData"));
				_sendStreamData(socket, "view", database.getViews(socket.padId));
				_sendStreamData(socket, "line", database.getPadLines(socket.padId));
			},

			updateBbox : function(bbox) {
				socket.bbox = bbox;

				// TODO: Only get objects for difference to last bbox

				_sendStreamData(socket, "marker", database.getPadMarkers(socket.padId, socket.bbox));
				_sendStreamData(socket, "linePoints", database.getLinePoints(socket.padId, socket.bbox));
			},

			disconnect : function() {
				if(socket.padId)
					listeners.removePadListener(socket);
			},

			editPad : function(data, callback) {
				database.updatePadData(socket.padId, data, callback);
			},

			addMarker : function(data, callback) {
				database.createMarker(socket.padId, data, callback);
			},

			editMarker : function(data, callback) {
				database.updateMarker(data.id, data, callback);
			},

			deleteMarker : function(data, callback) {
				database.deleteMarker(data.id, callback);
			},

			addLine : function(data, callback) {
				database.createLine(socket.padId, data, callback);
			},

			editLine : function(data, callback) {
				database.updateLine(data.id, data, callback);
			},

			deleteLine : function(data, callback) {
				database.deleteLine(data.id, callback);
			},

			addView : function(data, callback) {
				database.createView(socket.padId, data, callback);
			},

			editView : function(data, callback) {
				database.updateView(data.id, data, callback);
			},

			deleteView : function(data, callback) {
				database.deleteView(data.id, callback);
			}
		};

		for(var i in handlers)
			socket.on(i, handlers[i]);
	});
});

function _sendData(socket, eventName, err, data) {
	if(err) {
		console.warn("_sendData", err, err.stack);
		return socket.emit("error", err);
	}

	socket.emit(eventName, data);
}

function _sendStreamData(socket, eventName, stream) {
	stream.on("data", function(data) {
		if(data != null)
			socket.emit(eventName, data);
	}).on("error", function(err) {
		console.warn("_sendStreamData", err, err.stack);
		socket.emit("error", err);
	})
}