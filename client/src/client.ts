import { Manager, Socket as SocketIO } from "socket.io-client";
import {
	BboxWithZoom, EventHandler, EventName, FindOnMapQuery, FindQuery, HistoryEntry, ID, Line, LineCreate,
	LineExportRequest, LineTemplateRequest, LineUpdate, MapEvents, Marker, MarkerCreate, MarkerUpdate, MultipleEvents, ObjectWithId,
	PadData, PadDataCreate, PadDataUpdate, PadId, RequestData, RequestName, ResponseData, Route, RouteCreate, RouteExportRequest,
	RouteRequest,
	TrackPoint, Type, TypeCreate, TypeUpdate, View, ViewCreate, ViewUpdate, Writable
} from "facilmap-types";

declare module "facilmap-types/src/events" {
	interface MapEvents {
		connect: [];
		disconnect: [string];
		connect_error: [Error];

		error: [Error];
		reconnect: [number];
		reconnect_attempt: [number];
		reconnect_error: [Error];
		reconnect_failed: [];

		loadStart: [],
		loadEnd: []
	}
}

const MANAGER_EVENTS: Array<EventName<MapEvents>> = ['error', 'reconnect', 'reconnect_attempt', 'reconnect_error', 'reconnect_failed'];

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
	disconnected: boolean = true;
	server!: string;
	padId: string | undefined = undefined;
	bbox: BboxWithZoom | undefined = undefined;
	socket!: SocketIO;
	padData: PadData | undefined = undefined;
	readonly: boolean | undefined = undefined;
	writable: Writable | undefined = undefined;
	deleted: boolean = false;
	markers: Record<ID, Marker> = { };
	lines: Record<ID, LineWithTrackPoints> = { };
	views: Record<ID, View> = { };
	types: Record<ID, Type> = { };
	history: Record<ID, HistoryEntry> = { };
	route: RouteWithTrackPoints | undefined = undefined;
	serverError: Error | undefined = undefined;

	_listeners: {
		[E in EventName<MapEvents>]?: Array<EventHandler<MapEvents, E>>
	} = { };
	_listeningToHistory: boolean = false;

	constructor(server: string, padId?: string) {
		this._init(server, padId);
	}

	_init(server: string, padId: string | undefined) {
		// Needs to be in a separate method so that we can merge this class with a scope object in the frontend.

		this.server = server;
		this.padId = padId;

		const manager = new Manager(server, { forceNew: true });
		this.socket = manager.socket("/");

		for(let i of Object.keys(this._handlers) as EventName<MapEvents>[]) {
			this.on(i, this._handlers[i] as EventHandler<MapEvents, typeof i>);
		}

		setTimeout(() => {
			this._simulateEvent("loadStart");
		}, 0);
		this.once("connect", () => {
			this._simulateEvent("loadEnd");
		});
	}

	on<E extends EventName<MapEvents>>(eventName: E, fn: EventHandler<MapEvents, E>) {
		let listeners = this._listeners[eventName] as Array<EventHandler<MapEvents, E>> | undefined;
		if(!listeners) {
			listeners = this._listeners[eventName] = [ ];
			(MANAGER_EVENTS.includes(eventName) ? this.socket.io : this.socket)
				.on(eventName, (...[data]: MapEvents[E]) => { this._simulateEvent(eventName as any, data); });
		}

		listeners.push(fn);
    }

    once<E extends EventName<MapEvents>>(eventName: E, fn: EventHandler<MapEvents, E>) {
		let handler = ((data: any) => {
			this.removeListener(eventName, handler);
			(fn as any)(data);
		}) as EventHandler<MapEvents, E>;
		this.on(eventName, handler);
    }

	removeListener<E extends EventName<MapEvents>>(eventName: E, fn: EventHandler<MapEvents, E>) {
		const listeners = this._listeners[eventName] as Array<EventHandler<MapEvents, E>> | undefined;
		if(listeners) {
			this._listeners[eventName] = listeners.filter((listener) => (listener !== fn)) as any;
		}
	}

	_emit<R extends RequestName>(eventName: R, ...[data]: RequestData<R> extends void ? [ ] : [ RequestData<R> ]): Promise<ResponseData<R>> {
		return new Promise((resolve, reject) => {
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
		[E in EventName<MapEvents>]?: EventHandler<MapEvents, E>
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

	updateBbox(bbox: BboxWithZoom) {
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

	editMarker(data: ObjectWithId & MarkerUpdate) {
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

	editLine(data: ObjectWithId & LineUpdate) {
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

	getRoute(data: RouteRequest) {
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
		this.route = undefined;
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

	editType(data: ObjectWithId & TypeUpdate) {
		return this._emit("editType", data);
	}

	deleteType(data: ObjectWithId) {
		return this._emit("deleteType", data);
	}

	addView(data: ViewCreate) {
		return this._emit("addView", data);
	}

	editView(data: ObjectWithId & ViewUpdate) {
		return this._emit("editView", data);
	}

	deleteView(data: ObjectWithId) {
		return this._emit("deleteView", data);
	}

	geoip() {
		return this._emit("geoip");
	}

	disconnect() {
		this.socket.offAny();
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

	_receiveMultiple(obj?: MultipleEvents<MapEvents>) {
		if (obj) {
			for(const i of Object.keys(obj) as EventName<MapEvents>[])
				(obj[i] as Array<MapEvents[typeof i][0]>).forEach((it) => { this._simulateEvent(i, it as any); });
		}
	}

	_simulateEvent<E extends EventName<MapEvents>>(eventName: E, ...data: MapEvents[E]) {
		const listeners = this._listeners[eventName] as Array<EventHandler<MapEvents, E>> | undefined;
		if(listeners) {
			listeners.forEach(function(listener: EventHandler<MapEvents, E>) {
				listener(...data);
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
