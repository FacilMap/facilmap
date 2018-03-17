var socketIo = require("socket.io");
var domain = require("domain");
var Promise = require("bluebird");
var underscore = require("underscore");

var gpx = require("./export/gpx");
var utils = require("./utils");
var routing = require("./routing/routing");
var search = require("./search");

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

		this.route = null;

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

		return Promise.props(promises);
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

				admin: (validate) => {
					return this.database.getPadDataByAdminId(padId);
				},

				write: (validate) => {
					return this.database.getPadDataByWriteId(padId);
				},

				read: (validate) => {
					return this.database.getPadData(padId);
				},

				pad: (admin, write, read) => {
					if(admin)
						return utils.extend(JSON.parse(JSON.stringify(admin)), { writable: 2 });
					else if(write)
						return utils.extend(JSON.parse(JSON.stringify(write)), { writable: 1, adminId: null });
					else if(read)
						return utils.extend(JSON.parse(JSON.stringify(read)), { writable: 0, writeId: null, adminId: null });
					else {
						this.padId = null;
						throw "This pad does not exist";
					}
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

			let ret = {};

			if(this.padId && this.padId !== true) {
				ret.marker = utils.streamToArrayPromise(this.database.getPadMarkers(this.padId, bboxWithExcept));
				ret.linePoints = utils.streamToArrayPromise(this.database.getLinePointsForPad(this.padId, bboxWithExcept));
			}
			if(this.route)
				ret.routePoints = this.database.getRoutePoints(this.route.id, bboxWithExcept, !bboxWithExcept.except).then((points) => ([points]));

			return Promise.props(ret);
		},

		disconnect : function() {
			if(this.padId)
				this.unregisterDatabaseHandlers();

			if(this.route) {
				this.database.deleteRoute(this.route.id).catch((err) => {
					console.error("Error clearing route", err.stack || err);
				});
			}
		},

		createPad : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { name: "string", defaultViewId: "number", id: "string", writeId: "string", adminId: "string", searchEngines: "boolean", description: "string", clusterMarkers: "boolean", legend1: "string", legend2: "string" }))
					throw "Invalid parameters.";

				if(this.padId)
					throw "Pad already loaded.";

				return this.database.createPad(data);
			}).then((padData) => {
				this.padId = padData.id;
				this.writable = 2;

				this.registerDatabaseHandlers();

				return this.getPadObjects(padData);
			});
		},

		editPad : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { name: "string", defaultViewId: "number", id: "string", writeId: "string", adminId: "string", searchEngines: "boolean", description: "string", clusterMarkers: "boolean", legend1: "string", legend2: "string" }))
					throw "Invalid parameters.";

				if(this.writable != 2)
					throw "Map settings can only be changed in admin mode.";

				return this.database.updatePadData(this.padId, data);
			});
		},

		addMarker : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { lat: "number", lon: "number", name: "string", colour: "string", size: "number", symbol: "string", shape: "string", typeId: "number", data: Object } ))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				return this.database.createMarker(this.padId, data);
			});
		},

		editMarker : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number", lat: "number", lon: "number", name: "string", colour: "string", size: "number", symbol: "string", shape: "string", typeId: "number", data: Object }))
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

				if(this.route && data.mode != "track" && underscore.isEqual(this.route.routePoints, data.routePoints) && data.mode == this.route.mode)
					return this.database.getAllRoutePoints(this.route.id);
			}).then((trackPoints) => {
				return this.database.createLine(this.padId, data, trackPoints && Object.assign({}, this.route, {trackPoints}));
			});
		},

		editLine : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number", routePoints: [ { lat: "number", lon: "number" } ], trackPoints: [ { lat: "number", lon: "number" } ], mode: "string", colour: "string", width: "number", name: "string", typeId: "number", data: Object }))
					throw "Invalid parameters.";

				if(!this.writable)
					throw "In read-only mode.";

				if(this.route && data.mode != "track" && underscore.isEqual(this.route.routePoints, data.routePoints))
					return this.database.getAllRoutePoints(this.route.id);
			}).then((trackPoints) => {
				return this.database.updateLine(this.padId, data.id, data, null, trackPoints && Object.assign({}, this.route, {trackPoints}));
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

		exportLine: function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "string", format: "string" }))
					throw "Invalid parameters.";

				if(!this.padId)
					throw "No collaborative map opened.";

				return utils.promiseAuto({
					line: this.database.getLine(this.padId, data.id).then((line) => (JSON.parse(JSON.stringify(line)))),
					trackPoints: this.database.getAllLinePoints(data.id).then((trackPoints) => (JSON.parse(JSON.stringify(trackPoints)))),
					type: (line) => {
						this.database.getType(this.padId, line.typeId);
					}
				});
			}).then(({line, trackPoints, type}) => {
				line = Object.assign({}, line, {trackPoints});

				switch(data.format) {
					case "gpx-trk":
						return gpx.exportLine(line, type, true);
					case "gpx-rte":
						return gpx.exportLine(line, type, false);
					default:
						throw "Unknown format.";
				}
			});
		},

		addView : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { name: "string", baseLayer: "string", layers: [ "string" ], top: "number", left: "number", right: "number", bottom: "number", filter: "string" }))
					throw "Invalid parameters.";

				if(this.writable != 2)
					throw "Views can only be added in admin mode.";

				return this.database.createView(this.padId, data);
			});
		},

		editView : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number", baseLayer: "string", layers: [ "string" ], top: "number", left: "number", right: "number", bottom: "number", filter: "string" }))
					throw "Invalid parameters.";

				if(this.writable != 2)
					throw "Views can only be changed in admin mode.";

				return this.database.updateView(this.padId, data.id, data);
			});
		},

		deleteView : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number" }))
					throw "Invalid parameters.";

				if(this.writable != 2)
					throw "Views can only be deleted in admin mode.";

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
					defaultShape: "string", shapeFixed: "boolean",
					defaultWidth: "number", widthFixed: "boolean",
					defaultMode: "string", modeFixed: "boolean",
					showInLegend: "boolean",
					fields: [ {
						name: "string",
						type: "string",
						default: "string",
						controlColour: "boolean", controlSize: "boolean", controlSymbol: "boolean", controlShape: "boolean", controlWidth: "boolean",
						options: [ { key: "string", value: "string", colour: "string", size: "number", "symbol": "string", shape: "string", width: "number" } ]
					}]
				}))
					throw "Invalid parameters.";

				if(this.writable != 2)
					throw "Types can only be added in admin mode.";

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
					defaultShape: "string", shapeFixed: "boolean",
					defaultWidth: "number", widthFixed: "boolean",
					defaultMode: "string", modeFixed: "boolean",
					showInLegend: "boolean",
					fields: [ {
						name: "string",
						oldName: "string",
						type: "string",
						default: "string",
						controlColour: "boolean", controlSize: "boolean", controlSymbol: "boolean", controlShape: "boolean", controlWidth: "boolean",
						options: [ { key: "string", value: "string", oldValue: "string", colour: "string", size: "number", "symbol": "string", shape: "string", width: "number" } ]
					}]
				}))
					throw "Invalid parameters.";

				if(this.writable != 2)
					throw "Types can only be changed in admin mode.";

				let rename = {};
				for(let field of (data.fields || [])) {
					if(field.oldName && field.oldName != field.name)
						rename[field.oldName] = { name: field.name };

					if(field.type == "dropdown" && field.options) {
						for(let option of field.options) {
							if(option.oldValue && option.oldValue != option.value) {
								if(!rename[field.oldName || field.name])
									rename[field.oldName || field.name] = { };
								if(!rename[field.oldName || field.name].values)
									rename[field.oldName || field.name].values = { };

								rename[field.oldName || field.name].values[option.oldValue] = option.value;
							}

							delete option.oldValue;
						}
					}

					delete field.oldName;
				}

				// We first update the type (without updating the styles). If that succeeds, we rename the data fields.
				// Only then we update the object styles (as they often depend on the field values).
				return this.database.updateType(this.padId, data.id, data, false).then((newType) => {
					if(Object.keys(rename).length > 0)
						return this.database.renameObjectDataField(this.padId, data.id, rename, newType.type == "line").then(() => newType);
					else
						return newType;
				}).then((newType) => {
					return this.database.recalculateObjectStylesForType(newType.padId, newType.id, newType.type == "line").then(() => newType);
				});
			})
		},

		deleteType : function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "number" }))
					throw "Invalid parameters.";

				if(this.writable != 2)
					throw "Types can only be deleted in admin mode.";

				return this.database.deleteType(this.padId, data.id);
			});
		},

		find: function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { query: "string", loadUrls: "boolean", elevation: "boolean" }))
					throw "Invalid parameters.";

				return search.find(data.query, data.loadUrls, data.elevation);
			});
		},

		async findOnMap(data) {
			if(!utils.stripObject(data, { query: "string" }))
				throw new Error("Invalid parameters.");

			if(!this.padId)
				throw new Error("No collaborative map opened.");

			return this.database.search(this.padId, data.query);
		},

		getRoute: function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { destinations: [ { lat: "number", lon: "number" } ], mode: "string" }))
					throw "Invalid parameters.";

				return routing.calculateRouting(data.destinations, data.mode);
			});
		},

		setRoute: function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { routePoints: [ { lat: "number", lon: "number" } ], mode: "string" }))
					throw "Invalid parameters.";

				if(this.route)
					return this.database.updateRoute(this.route.id, data.routePoints, data.mode);
				else
					return this.database.createRoute(data.routePoints, data.mode);
			}).then((routeInfo) => {
				if(!routeInfo) {
					// A newer submitted route has returned in the meantime
					console.log("Ignoring outdated route");
					return;
				}

				this.route = routeInfo;

				if(this.bbox)
					routeInfo.trackPoints = routing.prepareForBoundingBox(routeInfo.trackPoints, this.bbox, true);
				else
					routeInfo.trackPoints = [];

				return {
					routePoints: routeInfo.routePoints,
					mode: routeInfo.mode,
					time: routeInfo.time,
					distance: routeInfo.distance,
					ascent: routeInfo.ascent,
					descent: routeInfo.descent,
					extraInfo: routeInfo.extraInfo,
					trackPoints: routeInfo.trackPoints
				};
			});
		},

		clearRoute: function() {
			return Promise.resolve().then(() => {
				if(this.route)
					return this.database.deleteRoute(this.route.id);
			}).then(() => {
				this.route = null;
			});
		},

		lineToRoute: function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { id: "string" }))
					throw "Invalid parameters.";

				if(!this.padId)
					throw "No collaborative map opened.";

				return this.database.lineToRoute(this.route && this.route.id, this.padId, data.id);
			}).then((routeInfo) => {
				this.route = routeInfo;

				if(this.bbox)
					routeInfo.trackPoints = routing.prepareForBoundingBox(routeInfo.trackPoints, this.bbox, true);
				else
					routeInfo.trackPoints = [];

				return {
					routePoints: routeInfo.routePoints,
					mode: routeInfo.mode,
					time: routeInfo.time,
					distance: routeInfo.distance,
					ascent: routeInfo.ascent,
					descent: routeInfo.descent,
					trackPoints: routeInfo.trackPoints
				};
			});
		},

		exportRoute: function(data) {
			return Promise.resolve().then(() => {
				if(!utils.stripObject(data, { format: "string" }))
					throw "Invalid parameters.";

				if(!this.route)
					throw "No route set.";

				return this.database.getAllRoutePoints(this.route.id);
			}).then((trackPoints) => {
				let route = Object.assign({}, this.route, {trackPoints});

				switch(data.format) {
					case "gpx-trk":
						return gpx.exportLine(route, null, true);
					case "gpx-rte":
						return gpx.exportLine(route, null, false);
					default:
						throw "Unknown format.";
				}
			});
		},

		listenToHistory: function() {
			return Promise.resolve().then(() => {
				if(!this.writable)
					throw "In read-only mode.";

				if(this.historyListener)
					throw "Already listening to history.";

				this.historyListener = this.registerDatabaseHandler("addHistoryEntry", (padId, data) => {
					if(padId == this.padId && (this.writable == 2 || ["Marker", "Line"].includes(data.type)))
						this.socket.emit("history", data);
				});

				return Promise.props({
					history: utils.streamToArrayPromise(this.database.getHistory(this.padId, this.writable == 2 ? null : ["Marker", "Line"]))
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

				return this.database.getHistoryEntry(this.padId, data.id);
			}).then((historyEntry) => {
				if(!["Marker", "Line"].includes(historyEntry.type) && this.writable != 2)
					throw "This kind of change can only be reverted in admin mode.";

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
				if(this.writable == 0)
					dataClone.writeId = null;
				if(this.writable != 2)
					dataClone.adminId = null;

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