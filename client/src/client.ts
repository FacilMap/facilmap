import { Manager, Socket as SocketIO } from "socket.io-client";
import {
	Bbox,
	BboxWithZoom, EventHandler, EventName, FindOnMapQuery, FindQuery, HistoryEntry, ID, Line, LineCreate,
	LineExportRequest, LineTemplateRequest, LineUpdate, MapEvents, Marker, MarkerCreate, MarkerUpdate, MultipleEvents, ObjectWithId,
	PadData, PadDataCreate, PadDataUpdate, PadId, RequestData, RequestName, ResponseData, Route, RouteCreate, RouteExportRequest,
	RouteInfo,
	RouteRequest,
	SearchResult,
	TrackPoint, Type, TypeCreate, TypeUpdate, View, ViewCreate, ViewUpdate, Writable
} from "facilmap-types";

export interface ClientEvents extends MapEvents {
	connect: [];
	disconnect: [string];
	connect_error: [Error];

	error: [Error];
	reconnect: [number];
	reconnect_attempt: [number];
	reconnect_error: [Error];
	reconnect_failed: [];

	serverError: [Error];

	loadStart: [],
	loadEnd: [],

	route: [RouteWithTrackPoints | undefined];

	emit: { [eventName in RequestName]: [eventName, RequestData<eventName>] }[RequestName]
}

const MANAGER_EVENTS: Array<EventName<ClientEvents>> = ['error', 'reconnect', 'reconnect_attempt', 'reconnect_error', 'reconnect_failed'];

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

export default class Client {
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
	loading: number = 0;

	_listeners: {
		[E in EventName<ClientEvents>]?: Array<EventHandler<ClientEvents, E>>
	} = { };
	_listeningToHistory: boolean = false;

	constructor(server: string, padId?: string) {
		this._init(server, padId);
	}

	_set<O, K extends keyof O>(object: O, key: K, value: O[K]): void {
		object[key] = value;
	}

	_delete<O>(object: O, key: keyof O): void {
		delete object[key];
	}

	_init(server: string, padId: string | undefined): void {
		// Needs to be in a separate method so that we can merge this class with a scope object in the frontend.

		this._set(this, 'server', server);
		this._set(this, 'padId', padId);

		const manager = new Manager(server, { forceNew: true });
		this._set(this, 'socket', manager.socket("/"));

		for(const i of Object.keys(this._handlers) as EventName<ClientEvents>[]) {
			this.on(i, this._handlers[i] as EventHandler<ClientEvents, typeof i>);
		}

		setTimeout(() => {
			this._simulateEvent("loadStart");
		}, 0);
		this.once("connect", () => {
			this._simulateEvent("loadEnd");
		});
	}

	on<E extends EventName<ClientEvents>>(eventName: E, fn: EventHandler<ClientEvents, E>): void {
		if(!this._listeners[eventName]) {
			(MANAGER_EVENTS.includes(eventName) ? this.socket.io : this.socket)
				.on(eventName, (...[data]: ClientEvents[E]) => { this._simulateEvent(eventName as any, data); });
		}

		this._set(this._listeners, eventName, [ ...(this._listeners[eventName] || [] as any), fn ]);
    }

    once<E extends EventName<ClientEvents>>(eventName: E, fn: EventHandler<ClientEvents, E>): void {
		const handler = ((data: any) => {
			this.removeListener(eventName, handler);
			(fn as any)(data);
		}) as EventHandler<ClientEvents, E>;
		this.on(eventName, handler);
    }

	removeListener<E extends EventName<ClientEvents>>(eventName: E, fn: EventHandler<ClientEvents, E>): void {
		const listeners = this._listeners[eventName] as Array<EventHandler<ClientEvents, E>> | undefined;
		if(listeners) {
			this._set(this._listeners, eventName, listeners.filter((listener) => (listener !== fn)) as any);
		}
	}

	async _emit<R extends RequestName>(eventName: R, ...[data]: RequestData<R> extends void ? [ ] : [ RequestData<R> ]): Promise<ResponseData<R>> {
		try {
			this._simulateEvent("loadStart");

			this._simulateEvent("emit", eventName as any, data as any);

			return await new Promise((resolve, reject) => {
				this.socket.emit(eventName, data, (err: Error, data: ResponseData<R>) => {
					if(err)
						reject(err);
					else
						resolve(data);
				});
			});
		} finally {
			this._simulateEvent("loadEnd");
		}
	}

	_handlers: {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} = {
		padData: (data) => {
			this._set(this, 'padData', data);

			if(data.writable != null) {
				this._set(this, 'readonly', data.writable == 0);
				this._set(this, 'writable', data.writable);
			}

			const id = this.writable == 2 ? data.adminId : this.writable == 1 ? data.writeId : data.id;
			if(id != null)
				this._set(this, 'padId', id);
		},

		deletePad: () => {
			this._set(this, 'readonly', true);
			this._set(this, 'writable', 0);
			this._set(this, 'deleted', true);
		},

		marker: (data) => {
			this._set(this.markers, data.id, data);
		},

		deleteMarker: (data) => {
			this._delete(this.markers, data.id);
		},

		line: (data) => {
			this._set(this.lines, data.id, {
				...data,
				trackPoints: this.lines[data.id]?.trackPoints || { }
			});
		},

		deleteLine: (data) => {
			this._delete(this.lines, data.id);
		},

		linePoints: (data) => {
			const line = this.lines[data.id];
			if(line == null)
				return console.error("Received line points for non-existing line "+data.id+".");

			this._set(line, 'trackPoints', this._mergeTrackPoints(data.reset ? {} : line.trackPoints, data.trackPoints));
		},

		routePoints: (data) => {
			if(!this.route) {
				console.error("Received route points for non-existing route.");
				return;
			}

			this._set(this.route, 'trackPoints', this._mergeTrackPoints(this.route.trackPoints, data));
		},

		view: (data) => {
			this._set(this.views, data.id, data);
		},

		deleteView: (data) => {
			this._delete(this.views, data.id);
			if (this.padData) {
				if(this.padData.defaultViewId == data.id)
					this._set(this.padData, 'defaultViewId', null);
			}
		},

		type: (data) => {
			this._set(this.types, data.id, data);
		},

		deleteType: (data) => {
			this._delete(this.types, data.id);
		},

		disconnect: () => {
			this._set(this, 'disconnected', true);
			this._set(this, 'markers', { });
			this._set(this, 'lines', { });
			this._set(this, 'views', { });
			this._set(this, 'history', { });
		},

		connect: () => {
			this._set(this, 'disconnected', false); // Otherwise it gets set when padData arrives

			if(this.padId)
				this._setPadId(this.padId);

			if(this.bbox)
				this.updateBbox(this.bbox);

			if(this._listeningToHistory) // TODO: Execute after setPadId() returns
				this.listenToHistory().catch(function(err) { console.error("Error listening to history", err); });

			if(this.route)
				this.setRoute(this.route);
		},

		history: (data) => {
			this._set(this.history, data.id, data);
			// TODO: Limit to 50 entries
		},

		loadStart: () => {
			this._set(this, 'loading', this.loading + 1);
		},

		loadEnd: () => {
			this._set(this, 'loading', this.loading - 1);
		}
	};

	setPadId(padId: PadId): Promise<void> {
		if(this.padId != null)
			throw new Error("Pad ID already set.");

		return this._setPadId(padId);
	}

	updateBbox(bbox: BboxWithZoom): Promise<void> {
		this._set(this, 'bbox', bbox);
		return this._emit("updateBbox", bbox).then((obj) => {
			this._receiveMultiple(obj);
		});
	}

	createPad(data: PadDataCreate): Promise<void> {
		return this._emit("createPad", data).then((obj) => {
			this._set(this, 'readonly', false);
			this._set(this, 'writable', 2);

			this._receiveMultiple(obj);
		});
	}

	editPad(data: PadDataUpdate): Promise<PadData> {
		return this._emit("editPad", data);
	}

	deletePad(): Promise<void> {
		return this._emit("deletePad");
	}

	listenToHistory(): Promise<void> {
		return this._emit("listenToHistory").then((obj) => {
			this._set(this, '_listeningToHistory', true);
			this._receiveMultiple(obj);
		});
	}

	stopListeningToHistory(): Promise<void> {
		this._set(this, '_listeningToHistory', false);
		return this._emit("stopListeningToHistory");
	}

	revertHistoryEntry(data: ObjectWithId): Promise<void> {
		return this._emit("revertHistoryEntry", data).then((obj) => {
			this._set(this, 'history', { });
			this._receiveMultiple(obj);
		});
	}

	async getMarker(data: ObjectWithId): Promise<Marker> {
		const marker = await this._emit("getMarker", data);
		this._set(this.markers, marker.id, marker);
		return marker;
	}

	addMarker(data: MarkerCreate): Promise<Marker> {
		return this._emit("addMarker", data);
	}

	editMarker(data: ObjectWithId & MarkerUpdate): Promise<Marker> {
		return this._emit("editMarker", data);
	}

	deleteMarker(data: ObjectWithId): Promise<Marker> {
		return this._emit("deleteMarker", data);
	}

	getLineTemplate(data: LineTemplateRequest): Promise<Line> {
		return this._emit("getLineTemplate", data);
	}

	addLine(data: LineCreate): Promise<Line> {
		return this._emit("addLine", data);
	}

	editLine(data: ObjectWithId & LineUpdate): Promise<Line> {
		return this._emit("editLine", data);
	}

	deleteLine(data: ObjectWithId): Promise<Line> {
		return this._emit("deleteLine", data);
	}

	exportLine(data: LineExportRequest): Promise<string> {
		return this._emit("exportLine", data);
	}

	find(data: FindQuery): Promise<string | SearchResult[]> {
		return this._emit("find", data);
	}

	findOnMap(data: FindOnMapQuery): Promise<ResponseData<'findOnMap'>> {
		return this._emit("findOnMap", data);
	}

	getRoute(data: RouteRequest): Promise<RouteInfo> {
		return this._emit("getRoute", data);
	}

	setRoute(data: RouteCreate): Promise<RouteWithTrackPoints | undefined> {
		return this._emit("setRoute", data).then((route) => {
			if(route) { // If unset, a newer submitted route has returned in the meantime
				this._set(this, 'route', {
					...route,
					trackPoints: this._mergeTrackPoints({}, route.trackPoints)
				});

				this._simulateEvent("route", this.route);
			}

			return this.route;
		});
	}

	clearRoute(): Promise<void> {
		this._set(this, 'route', undefined);
		this._simulateEvent("route", undefined);
		return this._emit("clearRoute");
	}

	lineToRoute(data: ObjectWithId): Promise<RouteWithTrackPoints | undefined> {
		return this._emit("lineToRoute", data).then((route) => {
			this._set(this, 'route', {
				...route,
				trackPoints: this._mergeTrackPoints({}, route.trackPoints)
			});

			this._simulateEvent("route", this.route);

			return this.route;
		});
	}

	exportRoute(data: RouteExportRequest): Promise<string> {
		return this._emit("exportRoute", data);
	}

	addType(data: TypeCreate): Promise<Type> {
		return this._emit("addType", data);
	}

	editType(data: ObjectWithId & TypeUpdate): Promise<Type> {
		return this._emit("editType", data);
	}

	deleteType(data: ObjectWithId): Promise<Type> {
		return this._emit("deleteType", data);
	}

	addView(data: ViewCreate): Promise<View> {
		return this._emit("addView", data);
	}

	editView(data: ObjectWithId & ViewUpdate): Promise<View> {
		return this._emit("editView", data);
	}

	deleteView(data: ObjectWithId): Promise<View> {
		return this._emit("deleteView", data);
	}

	geoip(): Promise<Bbox | null> {
		return this._emit("geoip");
	}

	disconnect(): void {
		this.socket.offAny();
		this.socket.disconnect();
	}

	async _setPadId(padId: string): Promise<void> {
		this._set(this, 'serverError', undefined);
		this._set(this, 'padId', padId);
		try {
			const obj = await this._emit("setPadId", padId);
			this._receiveMultiple(obj);
		} catch(err) {
			this._set(this, 'serverError', err);
			this._simulateEvent("serverError", err);
			throw err;
		}
	}

	_receiveMultiple(obj?: MultipleEvents<ClientEvents>): void {
		if (obj) {
			for(const i of Object.keys(obj) as EventName<ClientEvents>[])
				(obj[i] as Array<ClientEvents[typeof i][0]>).forEach((it) => { this._simulateEvent(i, it as any); });
		}
	}

	_simulateEvent<E extends EventName<ClientEvents>>(eventName: E, ...data: ClientEvents[E]): void {
		const listeners = this._listeners[eventName] as Array<EventHandler<ClientEvents, E>> | undefined;
		if(listeners) {
			listeners.forEach(function(listener: EventHandler<ClientEvents, E>) {
				listener(...data);
			});
		}
	}

	_mergeTrackPoints(existingTrackPoints: Record<number, TrackPoint> | null, newTrackPoints: TrackPoint[]): TrackPoints {
		const ret = { ...(existingTrackPoints || { }) } as TrackPoints;

		for(let i=0; i<newTrackPoints.length; i++) {
			ret[newTrackPoints[i].idx] = newTrackPoints[i];
		}

		ret.length = 0;
		for(const i in ret) {
			if(i != "length")
				ret.length = Math.max(ret.length, parseInt(i) + 1);
		}

		return ret;
	}
}
