var http = require("http");
var socketIo = require("socket.io");
var config = require("../config");
var listeners = require("./listeners");
var database = require("./database");

var app = http.createServer();
app.listen(config.port, config.host);
var io = socketIo.listen(app);

io.sockets.on("connection", function(socket) {
	socket.on("setPadId", setPadId.bind(null, socket));
	socket.on("updateBbox", updateBbox.bind(null, socket));
	socket.on("disconnect", disconnect.bind(null, socket));
	socket.on("editPad", editPad.bind(null, socket));
	socket.on("addMarker", addMarker.bind(null, socket));
	socket.on("editMarker", editMarker.bind(null, socket));
	socket.on("deleteMarker", deleteMarker.bind(null, socket));
	socket.on("addLine", addLine.bind(null, socket));
	socket.on("editLine", editLine.bind(null, socket));
	socket.on("deleteLine", deleteLine.bind(null, socket));
	socket.on("addView", addView.bind(null, socket));
	socket.on("editView", editView.bind(null, socket));
	socket.on("deleteView", deleteView.bind(null, socket));
});

function setPadId(socket, padId) {
	if(socket.padId != null) {
		return;
	}

	socket.padId = padId;
	listeners.addPadListener(socket);

	database.getPadData(socket.padId, _sendData.bind(null, socket, "padData"));
	_sendStreamData(socket, "view", database.getViews(socket.padId));
}

function editPad(socket, data, callback) {
	database.updatePadData(socket.padId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(socket.padId, null, "padData", _fixId(data));
		callback();
	});
}

function updateBbox(socket, bbox) {
	socket.bbox = bbox;

	// TODO: Only get objects for difference to last bbox

	_sendStreamData(socket, "marker", database.getPadMarkers(socket.padId, socket.bbox));
	_sendStreamData(socket, "line", database.getPadLines(socket.padId, socket.bbox));
}

function disconnect(socket) {
	if(socket.padId)
		listeners.removePadListener(socket);
}

function addMarker(socket, data, callback) {
	database.createMarker(socket.padId, data, function(err) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(socket.padId, data.position, "marker", _fixId(data));
		callback();
	});
}

function editMarker(socket, data, callback) {
	database.updateMarker(data.id, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(socket.padId, data.position, "marker", _fixId(data));
		callback();
	});
}

function deleteMarker(socket, data, callback) {
	database.deleteMarker(data.id, function(err) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(socket.padId, data.position, "deleteMarker", { id: data.id });
		callback();
	});
}

function addLine(socket, data, callback) {
	database.createLine(socket.padId, data, function(err) {
		if(err)
			return callback(err);

		// Todo: Coordinates
		listeners.notifyPadListeners(socket.padId, null, "line", _fixId(data));
		callback();
	});
}

function editLine(socket, data, callback) {
	database.updateLine(data.id, data, function(err, data) {
		if(err)
			return callback(err);

		// Todo: Coordinates
		listeners.notifyPadListeners(socket.padId, null, "line", _fixId(data));
		callback();
	});
}

function deleteLine(socket, data, callback) {
	database.deleteLine(data.id, function(err) {
		if(err)
			return callback(err);

		// Todo: Coordinates
		listeners.notifyPadListeners(socket.padId, null, "deleteLine", { id: data.id });
		callback();
	});
}

function addView(socket, data, callback) {
	if(data.name == null || data.name.trim().length == 0)
		return callback("No name provided.");

	database.createView(socket.padId, data, function(err) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(socket.padId, null, "view", _fixId(data));
		callback();
	});
}

function editView(socket, data, callback) {
	if(data.name == null || data.name.trim().length == 0)
		return callback("No name provided.");

	database.updateView(data.id, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(socket.padId, null, "view", _fixId(data));
		callback();
	});
}

function deleteView(socket, data, callback) {
	database.deleteView(data.id, function(err) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(socket.padId, null, "deleteView", { id: data.id });
		callback();
	});
}

function _sendData(socket, eventName, err, data) {
	if(err)
		return socket.emit("error", err);

	socket.emit(eventName, _fixId(data));
}

function _sendStreamData(socket, eventName, stream) {
	stream.on("data", function(data) {
		socket.emit(eventName, _fixId(data));
	}).on("error", function(err) {
		socket.emit("error", err);
	})
}

function _fixId(data) {
	var ret = JSON.parse(JSON.stringify(data));
	ret.id = ret._id;
	delete ret._id;

	if(ret.defaultView) {
		ret.defaultView.id = ret.defaultView._id;
		delete ret.defaultView._id;
	}

	return ret;
}