var http = require("http");
var socketIo = require("socket.io");
var config = require("../config");
var listeners = require("./listeners");
var database = require("./database");
var domain = require("domain");
var utils = require("./utils");
var routing = require("./routing");
var gpx = require("./gpx");

Object.defineProperty(Error.prototype, "toJSON", {
	value: function() {
		var str = this.message;
		if(this.errors) {
			for(var i=0; i<this.errors.length; i++)
				str += "\n"+this.errors[i].message;
		}

		return str;
	},
	configurable: true
});

database.connect(function(err) {
	if(err)
		throw err;

	var app = http.createServer();
	app.listen(config.port, config.host, function(err) {
		if(err)
			throw err;

		console.log("Server started on " + (config.host || "*" ) + ":" + config.port);
	});

	var io = socketIo.listen(app);

	io.sockets.on("connection", function(socket) {
		var d = domain.create();
		d.add(socket);

		d.on("error", function(err) {
			console.error("Uncaught error in socket:", err.stack);
			socket.disconnect();
		});

		var handlers = {
			error : function(err) {
				console.error("Error! Disconnecting client.");
				console.error(err.stack);
				socket.disconnect();
			},

			setPadId : function(padId) {
				if(typeof padId != "string" || socket.padId != null)
					return;

				socket.padId = true;

				database.getPadData(padId, function(err, data) {
					if(err)
						return _sendData(socket, "padData", err);

					socket.padId = data.id;
					socket.writable = data.writable;
					listeners.addPadListener(socket);

					_sendData(socket, "padData", null, data);
					_sendStreamData(socket, "view", database.getViews(socket.padId));
					_sendStreamData(socket, "type", database.getTypes(socket.padId));
					_sendStreamData(socket, "line", database.getPadLines(socket.padId));

					if(socket.bbox) { // In case bbox is set while fetching pad data
						_sendStreamData(socket, "marker", database.getPadMarkers(socket.padId, socket.bbox));
						_sendStreamData(socket, "linePoints", database.getLinePoints(socket.padId, socket.bbox));
					}
				});
			},

			updateBbox : function(bbox) {
				if(!utils.stripObject(bbox, { top: "number", left: "number", bottom: "number", right: "number", zoom: "number" }))
					return;

				var bboxWithExcept = utils.extend({ }, bbox);
				if(socket.bbox && bbox.zoom == socket.bbox.zoom)
					bboxWithExcept.except = socket.bbox;

				socket.bbox = bbox;

				if(socket.padId && socket.padId !== true) {
					_sendStreamData(socket, "marker", database.getPadMarkers(socket.padId, bboxWithExcept));
					_sendStreamData(socket, "linePoints", database.getLinePoints(socket.padId, bboxWithExcept));
				}
			},

			disconnect : function() {
				if(socket.padId)
					listeners.removePadListener(socket);
			},

			editPad : function(data, callback) {
				if(!utils.stripObject(data, { name: "string", defaultViewId: "number" }))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");
				
				database.updatePadData(socket.padId, data, callback);
			},

			addMarker : function(data, callback) {
				if(!utils.stripObject(data, { lat: "number", lon: "number", name: "string", colour: "string", typeId: "number", data: Object } ))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");
				
				database.createMarker(socket.padId, data, callback);
			},

			editMarker : function(data, callback) {
				if(!utils.stripObject(data, { id: "number", lat: "number", lon: "number", name: "string", colour: "string", typeId: "number", data: Object }))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");
				
				database.updateMarker(data.id, data, callback);
			},

			deleteMarker : function(data, callback) {
				if(!utils.stripObject(data, { id: "number" }))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");
				
				database.deleteMarker(data.id, callback);
			},

			getLineTemplate : function(data, callback) {
				if(!utils.stripObject(data, { typeId: "number" }) || data.typeId == null)
					return callback("Invalid parameters.");

				database.getLineTemplate(data, callback);
			},

			addLine : function(data, callback) {
				if(!utils.stripObject(data, { routePoints: [ { lat: "number", lon: "number" } ], mode: "string", colour: "string", width: "number", name: "string", typeId: "number", data: Object }))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");
				
				database.createLine(socket.padId, data, callback);
			},

			editLine : function(data, callback) {
				if(!utils.stripObject(data, { id: "number", routePoints: [ { lat: "number", lon: "number" } ], mode: "string", colour: "string", width: "number", name: "string", typeId: "number", data: Object }))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");
				
				database.updateLine(data.id, data, callback);
			},

			deleteLine : function(data, callback) {
				if(!utils.stripObject(data, { id: "number" }))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");
				
				database.deleteLine(data.id, callback);
			},

			addView : function(data, callback) {
				if(!utils.stripObject(data, { name: "string", baseLayer: "string", layers: [ "string" ], top: "number", left: "number", right: "number", bottom: "number" }))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");

				database.createView(socket.padId, data, callback);
			},

			editView : function(data, callback) {
				if(!utils.stripObject(data, { id: "number", baseLayer: "string", layers: [ "string" ], top: "number", left: "number", right: "number", bottom: "number" }))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");

				database.updateView(data.id, data, callback);
			},

			deleteView : function(data, callback) {
				if(!utils.stripObject(data, { id: "number" }))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");

				database.deleteView(data.id, callback);
			},

			addType : function(data, callback) {
				if(!utils.stripObject(data, { id: "number", name: "string", type: "string", fields: [ { name: "string", type: "string", default: "string", controlColour: "boolean", controlWidth: "boolean", options: [ { key: "string", value: "string", colour: "string", width: "number" } ] }] } ))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");

				database.createType(socket.padId, data, callback);
			},

			editType : function(data, callback) {
				if(!utils.stripObject(data, { id: "number", name: "string", fields: [ { name: "string", type: "string", default: "string", controlColour: "boolean", controlWidth: "boolean", options: [ { key: "string", value: "string", colour: "string", width: "number" } ] }] } ))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");

				database.updateType(data.id, data, callback);
			},

			deleteType : function(data, callback) {
				if(!utils.stripObject(data, { id: "number" }))
					return callback("Invalid parameters.");

				if(!socket.writable)
					return callback("In read-only mode.");

				database.deleteType(data.id, callback);
			},

			exportGpx : function(data, callback) {
				gpx.exportGpx(socket.padId, data.useTracks, callback);
			}

			/*copyPad : function(data, callback) {
				if(!utils.stripObject(data, { toId: "string" }))
					return callback("Invalid parameters.");

				database.copyPad(socket.padId, data.toId, callback);
			}*/
		};

		for(var i in handlers) { (function(i) {
			socket.on(i, function(data, callback) {
				var d2 = domain.create();
				d2.run(function() {
					handlers[i](data, callback);
				});

				d2.on("error", function(err) {
					console.error("Uncaught exception in function "+i+":", err.stack);
					callback(err);
				});
			});
		})(i); }
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