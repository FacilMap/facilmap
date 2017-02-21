const io = require("socket.io-client");
const Promise = require("es6-promise").Promise;

class Socket {
	constructor(server, padId) {
		this._init(server, padId);
	}

	_init(server, padId) {
		// Needs to be in a separate method so that we can merge this class with a scope object in the frontend.

		this.server = server;
		this.padId = padId;

		this.socket = io.connect(server, { 'force new connection': true });

		this.padData = null;
		this.readonly = null;
		this.markers = { };
		this.lines = { };
		this.views = { };
		this.types = { };
		this.history = { };

		this._listeners = [ ];

		for(let i in this._handlers) {
			this.on(i, this._handlers[i].bind(this));
		}

		this._simulateEvent("loadStart");
		let firstConnectHandler = () => {
			this.removeListener("connect", firstConnectHandler);
			this._simulateEvent("loadEnd");
		};
		this.on("connect", firstConnectHandler);
	}

	on(eventName, fn) {
		if(typeof this._listeners[eventName] != "object") {
			this._listeners[eventName] = [ ];
			this.socket.on(eventName, this._simulateEvent.bind(this, eventName));
		}

		this._listeners[eventName].push(fn);
    }

	removeListener(event, fn) {
		return this.socket.removeListener(...arguments);
	}

	_emit(eventName, data) {
		return new Promise((resolve, reject) => {
			this._simulateEvent("loadStart");

			this.socket.emit(eventName, data, (err, data) => {
				this._simulateEvent("loadEnd");

				if(err)
					reject(err);
				else
					resolve(data);
			});
		});
	}

	setPadId(padId) {
		if(this.padId != null)
			throw new Error("Pad ID already set.");

		return this._setPadId(padId);
	}

	updateBbox(bbox) {
		this.bbox = bbox;
		return this._emit("updateBbox", bbox).then((obj) => {
			this._receiveMultiple(obj);
		});
	}

	createPad(data) {
		return this._emit("createPad", data).then((obj) => {
			this._receiveMultiple(obj);
		});
	}

	editPad(data) {
		return this._emit("editPad", data);
	}

	listenToHistory() {
		return this._emit("listenToHistory").then((obj) => {
			this._listeningToHistory = true;
			this._receiveMultiple(obj);
		});
	}

	stopListeningToHistory() {
		this._listeningToHistory = false;
		return this._emit("stopListeningToHistory");
	}

	revertHistoryEntry(data) {
		return this._emit("revertHistoryEntry", data).then((obj) => {
			this.history = { };
			this._receiveMultiple(obj);
		});
	}

	addMarker(data) {
		return this._emit("addMarker", data);
	}

	editMarker(data) {
		return this._emit("editMarker", data);
	}

	deleteMarker(data) {
		return this._emit("deleteMarker", data);
	}

	getLineTemplate(data) {
		return this._emit("getLineTemplate", data);
	}

	addLine(data) {
		return this._emit("addLine", data);
	}

	editLine(data) {
		return this._emit("editLine", data);
	}

	deleteLine(data) {
		return this._emit("deleteLine", data);
	}

	find(data) {
		return this._emit("find", data);
	}

	getRoute(data) {
		return this._emit("getRoute", data);
	}

	addType(data) {
		return this._emit("addType", data);
	}

	editType(data) {
		return this._emit("editType", data);
	}

	deleteType(data) {
		return this._emit("deleteType", data);
	}

	addView(data) {
		return this._emit("addView", data);
	}

	editView(data) {
		return this._emit("editView", data);
	}

	deleteView(data) {
		return this._emit("deleteView", data);
	}

	disconnect() {
		this.socket.removeAllListeners();
		this.socket.disconnect();
	}

	_setPadId(padId) {
		this.padId = padId;
		return this._emit("setPadId", padId).then((obj) => {
			this.disconnected = false;

			this._receiveMultiple(obj);
		}).catch((err) => {
			this.serverError = err;
			this.disconnect();
		});
	}

	_receiveMultiple(obj) {
		for(let i in obj || { })
			obj[i].forEach((it) => { this._simulateEvent(i, it); });
	}

	_simulateEvent(eventName, data) {
		if(typeof this._listeners[eventName] == "object") {
			this._listeners[eventName].forEach(function(listener) {
				listener(data);
			});
		}
	}
}

Socket.prototype._handlers = {
	padData(data) {
		this.padData = data;

		if(data.writable != null)
			this.readonly = !data.writable;

		let id = this.readonly ? data.id : data.writeId;
		if(id != null)
			this.padId = id;
	},

	marker(data) {
		if(this.markers[data.id] == null)
			this.markers[data.id] = { };

		this.markers[data.id] = data;
	},

	deleteMarker(data) {
		delete this.markers[data.id];
	},

	line(data) {
		if(this.lines[data.id])
			data.trackPoints = this.lines[data.id].trackPoints;
		else
			this.lines[data.id] = { };

		this.lines[data.id] = data;
	},

	deleteLine(data) {
		delete this.lines[data.id];
	},

	linePoints(data) {
		let line = this.lines[data.id];
		if(line == null)
			return console.error("Received line points for non-existing line "+data.id+".");

		if(line.trackPoints == null || data.reset)
			line.trackPoints = { };

		for(let i=0; i<data.trackPoints.length; i++) {
			line.trackPoints[data.trackPoints[i].idx] = data.trackPoints[i];
		}

		line.trackPoints.length = 0;
		for(let i in line.trackPoints) {
			if(i != "length" && i >= line.trackPoints.length)
				line.trackPoints.length = 1*i+1;
		}
	},

	view(data) {
		if(this.views[data.id] == null)
			this.views[data.id] = { };

		this.views[data.id] = data;
	},

	deleteView(data) {
		delete this.views[data.id];
		if(this.padData.defaultViewId == data.id)
			this.padData.defaultViewId = null;
	},

	type(data) {
		if(this.types[data.id] == null)
			this.types[data.id] = { };

		this.types[data.id] = data;
	},

	deleteType(data) {
		delete this.types[data.id];
	},

	disconnect() {
		this.disconnected = true;
		this.markers = { };
		this.lines = { };
		this.views = { };
		this.history = { };
	},

	connect() {
		if(this.padId)
			this._setPadId(this.padId);
		else
			this.disconnected = false; // Otherwise it gets set when padData arrives

		if(this.bbox)
			this.updateBbox(this.bbox);

		if(this._listeningToHistory) // TODO: Execute after setPadId() returns
			this.listenToHistory().catch(function(err) { console.error("Error listening to history", err); });
	},

	history(data) {
		this.history[data.id] = data;
		// TODO: Limit to 50 entries
	}
};

module.exports = Socket;