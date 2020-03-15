import io from "socket.io-client";
import { Promise as PromiseShim } from "es6-promise";
import {
	Bbox, EventData, EventDataParams, EventHandler, EventName, FindOnMapQuery, FindQuery, HistoryEntry, ID, Line, LineCreate,
	LineExportRequest, LineTemplateRequest, LineUpdate, Marker, MarkerCreate, MarkerUpdate, MultipleEvents, ObjectWithId,
	PadData, PadDataCreate, PadDataUpdate, PadId, RequestData, RequestName, ResponseData, Route, RouteCreate, RouteExportRequest,
	TrackPoint, Type, TypeCreate, TypeUpdate, View, ViewCreate, ViewUpdate, Writable
} from "facilmap-types";

declare module "facilmap-types/src/events" {
	interface EventMap {
		connect: void,
		connect_error: Error;
		connect_timeout: void;
		reconnect: number;
		reconnect_attempt: number;
		reconnecting: number;
		reconnect_error: Error;
		reconnect_failed: void;
		disconnect: void,
		loadStart: void,
		loadEnd: void
	}
}

export interface TrackPoints {
	[idx: number]: TrackPoint;
	length: number
}

export interface LineWithTrackPoints extends Line {
	trackPoints: TrackPoints;
}

export interface RouteWithTrackPoints extends Omit<Route, "trackPoints"> {
	trackPoints: TrackPoints;
}

export default class Socket {
	disconnected!: boolean;
	server!: string;
	padId!: string;
	bbox!: Bbox | null;
	socket!: SocketIOClient.Socket;
	padData!: PadData | null;
	readonly!: boolean | null;
	writable!: Writable | null;
	deleted!: boolean;
	markers!: Record<ID, Marker>;
	lines!: Record<ID, LineWithTrackPoints>;
	views!: Record<ID, View>;
	types!: Record<ID, Type>;
	history!: Record<ID, HistoryEntry>;
	route!: RouteWithTrackPoints | null;
	serverError!: Error | null;

	_listeners!: {
		[E in EventName]?: Array<EventHandler<E>>
	};
	_listeningToHistory!: boolean;

	constructor(server: string, padId: string) {
		this._init(server, padId);
	}

	_init(server: string, padId: string) {
		// Needs to be in a separate method so that we can merge this class with a scope object in the frontend.

		this.server = server;
		this.padId = padId;
		this.bbox = null;
		this.serverError = null;

		this.disconnected = true;
		this.socket = io.connect(server, { forceNew: true });

		this.padData = null;
		this.readonly = null;
		this.writable = null;
		this.deleted = false;
		this.markers = { };
		this.lines = { };
		this.views = { };
		this.types = { };
		this.history = { };
		this.route = null;

		this._listeners = { };
		this._listeningToHistory = false;

		for(let i of Object.keys(this._handlers) as EventName[]) {
			this.on(i, this._handlers[i] as EventHandler<typeof i>);
		}

		setTimeout(() => {
			this._simulateEvent("loadStart");
		}, 0);
		this.once("connect", () => {
			this._simulateEvent("loadEnd");
		});
	}

	on<E extends EventName>(eventName: E, fn: EventHandler<E>) {
		let listeners = this._listeners[eventName] as Array<EventHandler<E>> | undefined;
		if(!listeners) {
			listeners = this._listeners[eventName] = [ ];
			this.socket.on(eventName, (data: EventData<E>) => { this._simulateEvent(eventName as any, data); });
		}

		listeners.push(fn);
    }

    once<E extends EventName>(eventName: E, fn: EventHandler<E>) {
		let handler: EventHandler<E> = (data) => {
			this.removeListener(eventName, handler);
			fn(data);
		};
		this.on(eventName, handler);
    }

	removeListener<E extends EventName>(eventName: E, fn: EventHandler<E>) {
		const listeners = this._listeners[eventName] as Array<EventHandler<E>> | undefined;
		if(listeners) {
			this._listeners[eventName] = listeners.filter((listener) => (listener !== fn)) as any;
		}
	}

	_emit<R extends RequestName>(eventName: R, ...[data]: RequestData<R> extends void ? [ ] : [ RequestData<R> ]): PromiseShim<ResponseData<R>> {
		return new PromiseShim((resolve, reject) => {
			this._simulateEvent("loadStart");

			this.socket.emit(eventName, data, (err: Error, data: ResponseData<R>) => {
				this._simulateEvent("loadEnd");

				if(err)
					reject(err);
				else
					resolve(data);
			});
		});
	}

	_handlers: {
		[E in EventName]?: EventHandler<E>
	} = {
		padData: (data) => {
			this.padData = data;

			if(data.writable != null) {
				this.readonly = (data.writable == 0);
				this.writable = data.writable;
			}

			let id = this.writable == 2 ? data.adminId : this.writable == 1 ? data.writeId : data.id;
			if(id != null)
				this.padId = id;
		},

		deletePad: () => {
			this.readonly = true;
			this.writable = 0;
			this.deleted = true;
		},

		marker: (data) => {
			this.markers[data.id] = data;
		},

		deleteMarker: (data) => {
			delete this.markers[data.id];
		},

		line: (data) => {
			this.lines[data.id] = {
				...data,
				trackPoints: this.lines[data.id]?.trackPoints || { }
			};
		},

		deleteLine: (data) => {
			delete this.lines[data.id];
		},

		linePoints: (data) => {
			let line = this.lines[data.id];
			if(line == null)
				return console.error("Received line points for non-existing line "+data.id+".");

			line.trackPoints = this._mergeTrackPoints(data.reset ? {} : line.trackPoints, data.trackPoints);
		},

		routePoints: (data) => {
			if(!this.route) {
				console.error("Received route points for non-existing route.");
				return;
			}

			this.route.trackPoints = this._mergeTrackPoints(this.route.trackPoints, data);
		},

		view: (data) => {
			this.views[data.id] = data;
		},

		deleteView: (data) => {
			delete this.views[data.id];
			if (this.padData) {
				if(this.padData.defaultViewId == data.id)
					this.padData.defaultViewId = null;
			}
		},

		type: (data) => {
			this.types[data.id] = data;
		},

		deleteType: (data) => {
			delete this.types[data.id];
		},

		disconnect: () => {
			this.disconnected = true;
			this.markers = { };
			this.lines = { };
			this.views = { };
			this.history = { };
		},

		connect: () => {
			if(this.padId)
				this._setPadId(this.padId);
			else
				this.disconnected = false; // Otherwise it gets set when padData arrives

			if(this.bbox)
				this.updateBbox(this.bbox);

			if(this._listeningToHistory) // TODO: Execute after setPadId() returns
				this.listenToHistory().catch(function(err) { console.error("Error listening to history", err); });

			if(this.route)
				this.setRoute(this.route);
		},

		history: (data) => {
			this.history[data.id] = data;
			// TODO: Limit to 50 entries
		}
	};

	setPadId(padId: PadId) {
		if(this.padId != null)
			throw new Error("Pad ID already set.");

		return this._setPadId(padId);
	}

	updateBbox(bbox: Bbox) {
		this.bbox = bbox;
		return this._emit("updateBbox", bbox).then((obj) => {
			this._receiveMultiple(obj);
		});
	}

	createPad(data: PadDataCreate) {
		return this._emit("createPad", data).then((obj) => {
			this.readonly = false;
			this.writable = 2;

			this._receiveMultiple(obj);
		});
	}

	editPad(data: PadDataUpdate) {
		return this._emit("editPad", data);
	}

	deletePad() {
		return this._emit("deletePad");
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

	revertHistoryEntry(data: ObjectWithId) {
		return this._emit("revertHistoryEntry", data).then((obj) => {
			this.history = { };
			this._receiveMultiple(obj);
		});
	}

	async getMarker(data: ObjectWithId) {
		let marker = await this._emit("getMarker", data);
		this.markers[marker.id] = marker;
		return marker;
	}

	addMarker(data: MarkerCreate) {
		return this._emit("addMarker", data);
	}

	editMarker(data: MarkerUpdate) {
		return this._emit("editMarker", data);
	}

	deleteMarker(data: ObjectWithId) {
		return this._emit("deleteMarker", data);
	}

	getLineTemplate(data: LineTemplateRequest) {
		return this._emit("getLineTemplate", data);
	}

	addLine(data: LineCreate) {
		return this._emit("addLine", data);
	}

	editLine(data: LineUpdate) {
		return this._emit("editLine", data);
	}

	deleteLine(data: ObjectWithId) {
		return this._emit("deleteLine", data);
	}

	exportLine(data: LineExportRequest) {
		return this._emit("exportLine", data);
	}

	find(data: FindQuery) {
		return this._emit("find", data);
	}

	findOnMap(data: FindOnMapQuery) {
		return this._emit("findOnMap", data);
	}

	getRoute(data: RouteCreate) {
		return this._emit("getRoute", data);
	}

	setRoute(data: RouteCreate) {
		return this._emit("setRoute", data).then((route) => {
			if(route) { // If unset, a newer submitted route has returned in the meantime
				this.route = {
					...route,
					trackPoints: this._mergeTrackPoints({}, route.trackPoints)
				};
			}

			return this.route;
		});
	}

	clearRoute() {
		this.route = null;
		return this._emit("clearRoute");
	}

	lineToRoute(data: ObjectWithId) {
		return this._emit("lineToRoute", data).then((route) => {
			this.route = {
				...route,
				trackPoints: this._mergeTrackPoints({}, route.trackPoints)
			};

			return this.route;
		});
	}

	exportRoute(data: RouteExportRequest) {
		return this._emit("exportRoute", data);
	}

	addType(data: TypeCreate) {
		return this._emit("addType", data);
	}

	editType(data: TypeUpdate) {
		return this._emit("editType", data);
	}

	deleteType(data: ObjectWithId) {
		return this._emit("deleteType", data);
	}

	addView(data: ViewCreate) {
		return this._emit("addView", data);
	}

	editView(data: ViewUpdate) {
		return this._emit("editView", data);
	}

	deleteView(data: ObjectWithId) {
		return this._emit("deleteView", data);
	}

	geoip() {
		return this._emit("geoip");
	}

	disconnect() {
		this.socket.removeAllListeners();
		this.socket.disconnect();
	}

	_setPadId(padId: string) {
		this.padId = padId;
		return this._emit("setPadId", padId).then((obj) => {
			this.disconnected = false;

			this._receiveMultiple(obj);
		}).catch((err) => {
			this.serverError = err;
			throw err;
		});
	}

	_receiveMultiple(obj?: MultipleEvents) {
		if (obj) {
			for(const i of Object.keys(obj) as EventName[])
				(obj[i] as Array<EventData<typeof i>>).forEach((it) => { this._simulateEvent(i, it); });
		}
	}

	_simulateEvent<E extends EventName>(eventName: E, ...[data]: EventDataParams<E>) {
		const listeners = this._listeners[eventName] as Array<EventHandler<E>> | undefined;
		if(listeners) {
			listeners.forEach(function(listener: EventHandler<E>) {
				listener(data as EventData<E>);
			});
		}
	}

	_mergeTrackPoints(existingTrackPoints: Record<number, TrackPoint> | null, newTrackPoints: TrackPoint[]) {
		let ret = { ...(existingTrackPoints || { }) } as TrackPoints;

		for(let i=0; i<newTrackPoints.length; i++) {
			ret[newTrackPoints[i].idx] = newTrackPoints[i];
		}

		ret.length = 0;
		for(let i in ret) {
			if(i != "length")
				ret.length = Math.max(ret.length, parseInt(i) + 1);
		}

		return ret;
	}
}
