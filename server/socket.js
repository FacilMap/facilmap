var socketIo = require("socket.io");
var domain = require("domain");

var utils = require("./utils");
var routing = require("./routing");
var search = require("./search");
var gpx = require("./gpx");

class Socket {
	constructor(server, database) {
		var io = socketIo.listen(server);

		io.sockets.on("connection", (socket) => {
			var d = domain.create();
			d.add(socket);

			d.on("error", function(err) {
				console.error("Uncaught error in socket:", err.stack);
				socket.disconnect();
			});

			new SocketConnection(socket, database);
		});
	}
}

class SocketConnection {
	constructor(socket, database) {
		this.socket = socket;
		this.database = database;

		this.padId = null;
		this.bbox = null;
		this.writable = null;

		this._dbHandlers = [ ];

		this.registerSocketHandlers();
	}

	registerSocketHandlers() {
		Object.keys(this.socketHandlers).forEach((i) => {
			this.socket.on(i, (data, callback) => {
				Promise.resolve(data).then(this.socketHandlers[i].bind(this)).then((res) => { // nodeify(callback);
					if(!callback && res)
						console.trace("No callback available to send result of socket handler " + i);

					callback && callback(null, res);
				}, (err) => {
					console.log(err.stack);

					callback && callback(err);
				}).catch(err => {
					console.error("Error in socket handler for "+i, err.stack);
				});
			});
		});
	}

	registerDatabaseHandler(eventName, handler) {
		var func = handler.bind(this);

		this.database.on(eventName, func);

		if(!this._dbHandlers[eventName])
			this._dbHandlers[eventName] = [ ];

		this._dbHandlers[eventName].push(func);

		return () => {
			this.database.removeListener(eventName, func);
			this._dbHandlers[eventName] = this._dbHandlers[eventName].filter(function(it) { return it !== func; });
		};
	}

	registerDatabaseHandlers() {
		Object.keys(this.databaseHandlers).forEach((eventName) => {
			this.registerDatabaseHandler(eventName, this.databaseHandlers[eventName]);
		});
	}

	unregisterDatabaseHandlers() {
		Object.keys(this._dbHandlers).forEach((eventName) => {
			this._dbHandlers[eventName].forEach((it) => {
				this.database.removeListener(eventName, it);
			});
		});
		this._dbHandlers = { };
	}

	sendStreamData(eventName, stream) {
		stream.on("data", (data) => {
			if(data != null)
				this.socket.emit(eventName, data);
		}).on("error", (err) => {
			console.warn("SocketConnection.sendStreamData", err.stack);
			this.socket.emit("error", err);
		});
	}

	getPadObjects(padData) {
		var promises = {
			padData: [ padData ],
			view: utils.streamToArrayPromise(this.database.getViews(padData.id)),
			type: utils.streamToArrayPromise(this.database.getTypes(padData.id)),
			line: utils.streamToArrayPromise(this.database.getPadLines(padData.id))
		};

		if(this.bbox) { // In case bbox is set while fetching pad data
			utils.extend(promises, {
				marker: utils.streamToArrayPromise(this.database.getPadMarkers(padData.id, this.bbox)),
				linePoints: utils.streamToArrayPromise(this.database.getLinePointsForPad(padData.id, this.bbox))
			});
		}

		return utils.promiseAllObject(promises);
	}
}

utils.extend(SocketConnection.prototype, {
	socketHandlers: {
		error : function(err) {
			console.error("Error! Disconnecting client.");
			console.error(err.stack);
			this.socket.disconnect();
		},

		setPadId : function(padId) {
			return utils.promiseAuto({
				validate: () => {
					if(typeof padId != "string")
						throw "Invalid pad id";
					if(this.padId != null)
						throw "Pad id already set";

					this.padId = true;
				},

				write: (validate) => {
					return this.database.getPadDataByWriteId(padId);
				},

				read: (validate) => {
					return this.database.getPadData(padId);
				},

				pad: (write, read) => {
					if(write)
						return utils.extend(JSON.parse(JSON.stringify(write)), { writable: true });
					else if(read)
						return utils.extend(JSON.parse(JSON.stringify(read)), { writable: false, writeId: null });
					else
						throw "This pad does not exist";
				}
			}).then(res => {
				this.padId = res.pad.id;
				this.writable = res.pad.writable;

				this.registerDatabaseHandlers();

				return this.getPadObjects(res.pad);
			});
		},

		updateBbox : function(bbox) {
			if(!utils.stripObject(bbox, { top: "number", left: "number", bottom: "number", right: "number", zoom: "number" }))
				return;

			var bboxWithExcept = utils.extend({ }, bbox);
			if(this.bbox && bbox.zoom == this.bbox.zoom)
				bboxWithExcept.except = this.bbox;

			this.bbox = bbox;

			if(this.padId && this.padId !== true) {
				return utils.promiseAllObject({
					marker: utils.streamToArrayPromise(this.database.getPadMarkers(this.padId, bboxWithExcept)),
					linePoints: utils.streamToArrayPromise(this.database.getLinePointsForPad(this.padId, bboxWithExcept))
				});
			}
		},

		disconnect : function() {
			if(this.padId)
				this.unregisterDatabaseHandlers();
		},

		createPad : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { name: "string", defaultViewId: "number", id: "string", writeId: "string", searchEngines: "boolean", description: "string" }))
					throw "Invalid parameters.";

				if(this.padId)
					throw "Pad already loaded.";

				return this.database.createPad(data);
			}).then((padData) => {
				this.padId = padData.id;
				this.writable = true;

				this.registerDatabaseHandlers();

				return this.getPadObjects(padData);
			});
		},

		editPad : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { name: "string", defaultViewId: "number", id: "string", writeId: "string", searchEngines: "boolean", description: "string" }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.updatePadData(this.padId, data);
			});
		},

		addMarker : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { lat: "number", lon: "number", name: "string", colour: "string", size: "number", symbol: "string", typeId: "number", data: Object } ))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.createMarker(this.padId, data);
			});
		},

		editMarker : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number", lat: "number", lon: "number", name: "string", colour: "string", size: "number", symbol: "string", typeId: "number", data: Object }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.updateMarker(this.padId, data.id, data);
			});
		},

		deleteMarker : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number" }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.deleteMarker(this.padId, data.id);
			});
		},

		getLineTemplate : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { typeId: "number" }) || data.typeId == null)
					throw "Invalid parameters.";

				return this.database.getLineTemplate(this.padId, data);
			});
		},

		addLine : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { routePoints: [ { lat: "number", lon: "number" } ], trackPoints: [ { lat: "number", lon: "number" } ], mode: "string", colour: "string", width: "number", name: "string", typeId: "number", data: Object }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.createLine(this.padId, data);
			});
		},

		editLine : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number", routePoints: [ { lat: "number", lon: "number" } ], trackPoints: [ { lat: "number", lon: "number" } ], mode: "string", colour: "string", width: "number", name: "string", typeId: "number", data: Object }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.updateLine(this.padId, data.id, data);
			});
		},

		deleteLine : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number" }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.deleteLine(this.padId, data.id);
			});
		},

		addView : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { name: "string", baseLayer: "string", layers: [ "string" ], top: "number", left: "number", right: "number", bottom: "number", filter: "string" }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.createView(this.padId, data);
			});
		},

		editView : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number", baseLayer: "string", layers: [ "string" ], top: "number", left: "number", right: "number", bottom: "number", filter: "string" }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.updateView(this.padId, data.id, data);
			});
		},

		deleteView : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number" }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.deleteView(this.padId, data.id);
			});
		},

		addType : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, {
					id: "number",
					name: "string",
					type: "string",
					defaultColour: "string", colourFixed: "boolean",
					defaultSize: "number", sizeFixed: "boolean",
					defaultSymbol: "string", symbolFixed: "boolean",
					defaultWidth: "number", widthFixed: "boolean",
					defaultMode: "string", modeFixed: "boolean",
					fields: [ {
						name: "string",
						type: "string",
						default: "string",
						controlColour: "boolean", controlSize: "boolean", controlSymbol: "boolean", controlWidth: "boolean",
						options: [ { key: "string", value: "string", colour: "string", size: "number", "symbol": "string", width: "number" } ]
					}]
				}))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.createType(this.padId, data);
			});
		},

		editType : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, {
					id: "number",
					name: "string",
					defaultColour: "string", colourFixed: "boolean",
					defaultSize: "number", sizeFixed: "boolean",
					defaultSymbol: "string", symbolFixed: "boolean",
					defaultWidth: "number", widthFixed: "boolean",
					defaultMode: "string", modeFixed: "boolean",
					fields: [ {
						name: "string",
						type: "string",
						default: "string",
						controlColour: "boolean", controlSize: "boolean", controlSymbol: "boolean", controlWidth: "boolean",
						options: [ { key: "string", value: "string", colour: "string", size: "number", "symbol": "string", width: "number" } ]
					}]
				}))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.updateType(this.padId, data.id, data);
			});
		},

		deleteType : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number" }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.deleteType(this.padId, data.id);
			});
		},

		exportGpx : function(data) {
			return Promise.resolve().then(() => {
				if(this.padId == null)
					throw "No pad ID set.";

				return gpx.exportGpx(this.database, this.padId, data.useTracks);
			});
		},

		find: function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { query: "string", loadUrls: "boolean" }))
					throw "Invalid parameters.";

				return search.find(data.query, data.loadUrls);
			});
		},

		getRoute: function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { destinations: [ { lat: "number", lon: "number" } ], mode: "string" }))
					throw "Invalid parameters.";

				return routing.calculateRouting(data.destinations, data.mode, false);
			});
		},

		listenToHistory: function() {
			return Promise.resolve().then(() => {
				if(!this.writable)
					throw "In read-only mode.";

				if(this.historyListener)
					throw "Already listening to history.";

				this.historyListener = this.registerDatabaseHandler("addHistoryEntry", (padId, data) => {
					if(padId == this.padId)
						this.socket.emit("history", data);
				});

				return utils.promiseAllObject({
					history: utils.streamToArrayPromise(this.database.getHistory(this.padId))
				});
			});
		},

		stopListeningToHistory: function() {
			if(!this.historyListener)
				throw "Not listening to history.";

			if(!this.writable)
				throw "In read-only mode.";

			this.historyListener(); // Unregister db listener
			this.historyListener = null;
		},

		revertHistoryEntry: function(data) {
			var listening = !!this.historyListener;

			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number" }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				if(listening)
					this.socketHandlers.stopListeningToHistory.call(this);

				return this.database.revertHistoryEntry(this.padId, data.id);
			}).then(() => {
				if(listening)
					return this.socketHandlers.listenToHistory.call(this);
			});
		}

		/*copyPad : function(data, callback) {
			if(!utils.stripObject(data, { toId: "string" }))
				return callback("Invalid parameters.");

			this.database.copyPad(this.padId, data.toId, callback);
		}*/
	},

	databaseHandlers: {
		line: function(padId, data) {
			if(padId == this.padId)
				this.socket.emit("line", data);
		},

		linePoints: function(padId, lineId, trackPoints) {
			if(padId == this.padId)
				this.socket.emit("linePoints", { reset: true, id: lineId, trackPoints : (this.bbox ? routing.prepareForBoundingBox(trackPoints, this.bbox) : [ ]) });
		},

		deleteLine: function(padId, data) {
			if(padId == this.padId)
				this.socket.emit("deleteLine", data);
		},

		marker: function(padId, data) {
			if(padId == this.padId && this.bbox && utils.isInBbox(data, this.bbox))
				this.socket.emit("marker", data);
		},

		deleteMarker: function(padId, data) {
			if(padId == this.padId)
				this.socket.emit("deleteMarker", data);
		},

		type: function(padId, data) {
			if(padId == this.padId)
				this.socket.emit("type", data);
		},

		deleteType: function(padId, data) {
			if(padId == this.padId)
				this.socket.emit("deleteType", data);
		},

		padData: function(padId, data) {
			if(padId == this.padId) {
				var dataClone = JSON.parse(JSON.stringify(data));
				if(!this.writable)
					dataClone.writeId = null;

				this.padId = data.id;

				this.socket.emit("padData", dataClone);
			}
		},

		view: function(padId, data) {
			if(padId == this.padId)
				this.socket.emit("view", data);
		},

		deleteView: function(padId, data) {
			if(padId == this.padId)
				this.socket.emit("deleteView", data);
		}
	}
});

module.exports = Socket;