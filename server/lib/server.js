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

				socket.padId = true;

				database.getPadData(padId, function(err, data) {
					if(err)
						return _sendData(socket, "padData", err);

					socket.padId = data.id;
					socket.writable = data.writable;
					listeners.addPadListener(socket);

					_sendData(socket, "padData", null, data);
					_sendStreamData(socket, "view", database.getViews(socket.padId));
					_sendStreamData(socket, "line", database.getPadLines(socket.padId));
				});
			},

			updateBbox : function(bbox) {
				var bboxWithExcept = utils.extend({ }, bbox);
				if(socket.bbox && bbox.zoom == socket.bbox.zoom)
					bboxWithExcept.except = socket.bbox;

				socket.bbox = bbox;

				_sendStreamData(socket, "marker", database.getPadMarkers(socket.padId, bboxWithExcept));
				_sendStreamData(socket, "linePoints", database.getLinePoints(socket.padId, bboxWithExcept));
			},

			disconnect : function() {
				if(socket.padId)
					listeners.removePadListener(socket);
			},

			editPad : function(data, callback) {
				if(!socket.writable)
					return callback(new Error("In read-only mode."));
				
				database.updatePadData(socket.padId, data, callback);
			},

			addMarker : function(data, callback) {
				if(!socket.writable)
					return callback(new Error("In read-only mode."));
				
				database.createMarker(socket.padId, data, callback);
			},

			editMarker : function(data, callback) {
				if(!socket.writable)
					return callback(new Error("In read-only mode."));
				
				database.updateMarker(data.id, data, callback);
			},

			deleteMarker : function(data, callback) {
				if(!socket.writable)
					return callback(new Error("In read-only mode."));
				
				database.deleteMarker(data.id, callback);
			},

			addLine : function(data, callback) {
				if(!socket.writable)
					return callback(new Error("In read-only mode."));
				
				database.createLine(socket.padId, data, callback);
			},

			editLine : function(data, callback) {
				if(!socket.writable)
					return callback(new Error("In read-only mode."));
				
				database.updateLine(data.id, data, callback);
			},

			deleteLine : function(data, callback) {
				if(!socket.writable)
					return callback(new Error("In read-only mode."));
				
				database.deleteLine(data.id, callback);
			},

			addView : function(data, callback) {
				if(!socket.writable)
					return callback(new Error("In read-only mode."));

				database.createView(socket.padId, data, callback);
			},

			editView : function(data, callback) {
				if(!socket.writable)
					return callback(new Error("In read-only mode."));

				database.updateView(data.id, data, callback);
			},

			deleteView : function(data, callback) {
				if(!socket.writable)
					return callback(new Error("In read-only mode."));

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