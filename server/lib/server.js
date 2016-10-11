var http = require("http");
var socketIo = require("socket.io");
var config = require("../config");
var listeners = require("./listeners");
var database = require("./database");
var domain = require("domain");
var utils = require("./utils");
var routing = require("./routing");
var gpx = require("./gpx");
var search = require("./search");
var Promise = require("promise");

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

var dbP = database.connect();

var app = http.createServer();
var appP = Promise.denodeify(app.listen.bind(app))(config.port, config.host).then(function() {
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

				database.getPadData(padId).then(function(data) {
					_setPadId(socket, data);
				}, function(err) {
					socket.emit("serverError", err);
					socket.disconnect();
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

			createPad : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { name: "string", defaultViewId: "number", id: "string", writeId: "string" }))
						throw "Invalid parameters.";

					if(socket.padId)
						throw "Pad already loaded.";

					return database.createPad(data);
				}).then(function(padData) {
					_setPadId(socket, padData);

					return padData;
				});
			},

			editPad : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { name: "string", defaultViewId: "number", id: "string", writeId: "string" }))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.updatePadData(socket.padId, data);
				});
			},

			addMarker : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { lat: "number", lon: "number", name: "string", colour: "string", typeId: "number", data: Object } ))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.createMarker(socket.padId, data);
				});
			},

			editMarker : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { id: "number", lat: "number", lon: "number", name: "string", colour: "string", typeId: "number", data: Object }))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.updateMarker(data.id, data);
				});
			},

			deleteMarker : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { id: "number" }))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.deleteMarker(data.id);
				});
			},

			getLineTemplate : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { typeId: "number" }) || data.typeId == null)
						throw "Invalid parameters.";

					return database.getLineTemplate(data);
				});
			},

			addLine : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { routePoints: [ { lat: "number", lon: "number" } ], mode: "string", colour: "string", width: "number", name: "string", typeId: "number", data: Object }))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.createLine(socket.padId, data);
				});
			},

			editLine : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { id: "number", routePoints: [ { lat: "number", lon: "number" } ], mode: "string", colour: "string", width: "number", name: "string", typeId: "number", data: Object }))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.updateLine(data.id, data);
				});
			},

			deleteLine : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { id: "number" }))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.deleteLine(data.id);
				});
			},

			addView : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { name: "string", baseLayer: "string", layers: [ "string" ], top: "number", left: "number", right: "number", bottom: "number" }))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.createView(socket.padId, data);
				});
			},

			editView : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { id: "number", baseLayer: "string", layers: [ "string" ], top: "number", left: "number", right: "number", bottom: "number" }))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.updateView(data.id, data);
				});
			},

			deleteView : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { id: "number" }))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.deleteView(data.id);
				});
			},

			addType : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { id: "number", name: "string", type: "string", fields: [ { name: "string", type: "string", default: "string", controlColour: "boolean", controlWidth: "boolean", options: [ { key: "string", value: "string", colour: "string", width: "number" } ] }] } ))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.createType(socket.padId, data);
				});
			},

			editType : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { id: "number", name: "string", fields: [ { name: "string", type: "string", default: "string", controlColour: "boolean", controlWidth: "boolean", options: [ { key: "string", value: "string", colour: "string", width: "number" } ] }] } ))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.updateType(data.id, data);
				});
			},

			deleteType : function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { id: "number" }))
						throw "Invalid parameters.";

					if(!socket.writable)
						throw "In read-only mode.";

					return database.deleteType(data.id);
				});
			},

			exportGpx : function(data) {
				return Promise.resolve().then(function() {
					if(socket.padId == null)
						throw "No pad ID set.";

					return gpx.exportGpx(socket.padId, data.useTracks);
				});
			},

			find: function(data) {
				return Promise.resolve().then(function() {
					if(!utils.stripObject(data, { query: "string" }))
						throw "Invalid parameters.";

					return search.find(data.query);
				});
			}

			/*copyPad : function(data, callback) {
				if(!utils.stripObject(data, { toId: "string" }))
					return callback("Invalid parameters.");

				database.copyPad(socket.padId, data.toId, callback);
			}*/
		};

		for(var i in handlers) { (function(i) {
			socket.on(i, function(data, callback) {
				Promise.resolve(data).then(handlers[i]).then(function(res) { // nodeify(callback);
					callback(null, res);
				}, function(err) {
					console.log(err.stack);
					callback(err);
				});
			});
		})(i); }
	});
});

Promise.all([ dbP, appP ]).then(function() {
	console.log("Server started on " + (config.host || "*" ) + ":" + config.port);
}).catch(function(err) {
	console.error(err);
	process.exit(1);
});

function _sendStreamData(socket, eventName, stream) {
	stream.on("data", function(data) {
		if(data != null)
			socket.emit(eventName, data);
	}).on("error", function(err) {
		console.warn("_sendStreamData", err, err.stack);
		socket.emit("error", err);
	})
}

function _setPadId(socket, data) {
	socket.padId = data.id;
	socket.writable = data.writable;
	listeners.addPadListener(socket);

	socket.emit("padData", data);
	_sendStreamData(socket, "view", database.getViews(socket.padId));
	_sendStreamData(socket, "type", database.getTypes(socket.padId));
	_sendStreamData(socket, "line", database.getPadLines(socket.padId));

	if(socket.bbox) { // In case bbox is set while fetching pad data
		_sendStreamData(socket, "marker", database.getPadMarkers(socket.padId, socket.bbox));
		_sendStreamData(socket, "linePoints", database.getLinePoints(socket.padId, socket.bbox));
	}
}