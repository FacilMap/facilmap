import { io, type ManagerOptions, type Socket as SocketIO, type SocketOptions } from "socket.io-client";
import { type Bbox, type BboxWithZoom, type CRU, type EventHandler, type EventName, type FindOnMapQuery, type FindMapsQuery, type FindMapsResult, type FindQuery, type GetMapQuery, type HistoryEntry, type ID, type Line, type LineExportRequest, type LineTemplateRequest, type LineToRouteCreate, type SocketEvents, type Marker, type MultipleEvents, type ObjectWithId, type MapData, type MapId, type PagedResults, type SocketRequest, type SocketRequestName, type SocketResponse, type Route, type RouteClear, type RouteCreate, type RouteExportRequest, type RouteInfo, type RouteRequest, type SearchResult, type SocketVersion, type TrackPoint, type Type, type View, type Writable, type SocketClientToServerEvents, type SocketServerToClientEvents, type LineTemplate, type LinePointsEvent, PadNotFoundError, type SetLanguageRequest } from "facilmap-types";
import { deserializeError, errorConstructors, serializeError } from "serialize-error";

export interface ClientEventsInterface extends SocketEvents<SocketVersion.V3> {
	connect: [];
	disconnect: [string];
	connect_error: [Error];

	error: [Error];
	reconnect: [number];
	reconnect_attempt: [number];
	reconnect_error: [Error];
	reconnect_failed: [];

	serverError: [Error];

	loadStart: [];
	loadEnd: [];

	route: [RouteWithTrackPoints];
	clearRoute: [RouteClear];

	emit: { [eventName in SocketRequestName<SocketVersion.V3>]: [eventName, SocketRequest<SocketVersion.V3, eventName>] }[SocketRequestName<SocketVersion.V3>];
	emitResolve: { [eventName in SocketRequestName<SocketVersion.V3>]: [eventName, SocketResponse<SocketVersion.V3, eventName>] }[SocketRequestName<SocketVersion.V3>];
	emitReject: [SocketRequestName<SocketVersion.V3>, Error];
}

export type ClientEvents = Pick<ClientEventsInterface, keyof ClientEventsInterface>; // Workaround for https://github.com/microsoft/TypeScript/issues/15300

const MANAGER_EVENTS: Array<EventName<ClientEvents>> = ['error', 'reconnect', 'reconnect_attempt', 'reconnect_error', 'reconnect_failed'];

export interface TrackPoints {
	[idx: number]: TrackPoint;
	length: number;
}

export interface LineWithTrackPoints extends Line {
	trackPoints: TrackPoints;
}

export interface RouteWithTrackPoints extends Omit<Route, "trackPoints"> {
	routeId?: string;
	trackPoints: TrackPoints;
}

interface ClientState {
	disconnected: boolean;
	server: string;
	mapId: string | undefined;
	bbox: BboxWithZoom | undefined;
	readonly: boolean | undefined;
	writable: Writable | undefined;
	deleted: boolean;
	serverError: Error | undefined;
	loading: number;
	listeningToHistory: boolean;
}

interface ClientData {
	mapData: (MapData & { writable: Writable }) | undefined;
	markers: Record<ID, Marker>;
	lines: Record<ID, LineWithTrackPoints>;
	views: Record<ID, View>;
	types: Record<ID, Type>;
	history: Record<ID, HistoryEntry>;
	route: RouteWithTrackPoints | undefined;
	routes: Record<string, RouteWithTrackPoints>;
}

errorConstructors.set("PadNotFoundError", PadNotFoundError as any);

class Client {
	private socket: SocketIO<SocketServerToClientEvents<SocketVersion.V3>, SocketClientToServerEvents<SocketVersion.V3>>;
	private state: ClientState;
	private data: ClientData;

	private listeners: {
		[E in EventName<ClientEvents>]?: Array<EventHandler<ClientEvents, E>>
	} = { };

	constructor(server: string, mapId?: string, socketOptions?: Partial<ManagerOptions & SocketOptions>) {
		this.state = this._makeReactive({
			disconnected: true,
			server,
			mapId,
			bbox: undefined,
			readonly: undefined,
			writable: undefined,
			deleted: false,
			serverError: undefined,
			loading: 0,
			listeningToHistory: false
		});

		this.data = this._makeReactive({
			mapData: undefined,
			markers: { },
			lines: { },
			views: { },
			types: { },
			history: { },
			route: undefined,
			routes: { }
		});

		const serverUrl = typeof location != "undefined" ? new URL(this.state.server, location.href) : new URL(this.state.server);
		const socket = io(`${serverUrl.origin}/v3`, {
			forceNew: true,
			path: serverUrl.pathname.replace(/\/$/, "") + "/socket.io",
			...socketOptions
		});
		this.socket = socket;

		for(const i of Object.keys(this._handlers) as EventName<ClientEvents>[]) {
			this.on(i, this._handlers[i] as EventHandler<ClientEvents, typeof i>);
		}

		void Promise.resolve().then(() => {
			this._simulateEvent("loadStart");
		});

		this.once("connect", () => {
			this._simulateEvent("loadEnd");
		});
	}

	protected _makeReactive<O extends object>(object: O): O {
		return object;
	}

	protected _set<O, K extends keyof O>(object: O, key: K, value: O[K]): void {
		object[key] = value;
	}

	protected _delete<O>(object: O, key: keyof O): void {
		delete object[key];
	}

	protected _decodeData(data: Record<string, string>): Record<string, string> {
		const result = Object.create(null);
		Object.assign(result, data);
		return result;
	}

	private _fixResponseObject<T>(requestName: SocketRequestName<SocketVersion.V3>, obj: T): T {
		if (typeof obj != "object" || !(obj as any)?.data || !["getMarker", "addMarker", "editMarker", "deleteMarker", "getLineTemplate", "addLine", "editLine", "deleteLine"].includes(requestName))
			return obj;

		return {
			...obj,
			data: this._decodeData((obj as any).data)
		};
	}

	private _fixEventObject<T extends any[]>(eventName: EventName<ClientEvents>, obj: T): T {
		if (typeof obj?.[0] != "object" || !obj?.[0]?.data || !["marker", "line"].includes(eventName))
			return obj;

		return [
			{
				...obj[0],
				data: this._decodeData((obj[0] as any).data)
			},
			...obj.slice(1)
		] as T;
	}

	on<E extends EventName<ClientEvents>>(eventName: E, fn: EventHandler<ClientEvents, E>): void {
		if(!this.listeners[eventName]) {
			(MANAGER_EVENTS.includes(eventName) ? this.socket.io as any : this.socket)
				.on(eventName, (...[data]: ClientEvents[E]) => { this._simulateEvent(eventName as any, data); });
		}

		this.listeners[eventName] = [...(this.listeners[eventName] || [] as any), fn];
	}

	once<E extends EventName<ClientEvents>>(eventName: E, fn: EventHandler<ClientEvents, E>): void {
		const handler = ((data: any) => {
			this.removeListener(eventName, handler);
			(fn as any)(data);
		}) as EventHandler<ClientEvents, E>;
		this.on(eventName, handler);
	}

	removeListener<E extends EventName<ClientEvents>>(eventName: E, fn: EventHandler<ClientEvents, E>): void {
		const listeners = this.listeners[eventName] as Array<EventHandler<ClientEvents, E>> | undefined;
		if(listeners) {
			this.listeners[eventName] = listeners.filter((listener) => (listener !== fn)) as any;
		}
	}

	private async _emit<R extends SocketRequestName<SocketVersion.V3>>(eventName: R, ...[data]: SocketRequest<SocketVersion.V3, R> extends undefined | null ? [ ] : [ SocketRequest<SocketVersion.V3, R> ]): Promise<SocketResponse<SocketVersion.V3, R>> {
		try {
			this._simulateEvent("loadStart");

			this._simulateEvent("emit", eventName as any, data as any);

			const outerError = new Error();
			return await new Promise((resolve, reject) => {
				this.socket.emit(eventName as any, data, (err: any, data: SocketResponse<SocketVersion.V3, R>) => {
					if(err) {
						const cause = deserializeError(err);
						reject(deserializeError({ ...serializeError(outerError), message: cause.message, cause }));
						this._simulateEvent("emitReject", eventName as any, err);
					} else {
						const fixedData = this._fixResponseObject(eventName, data);
						resolve(fixedData);
						this._simulateEvent("emitResolve", eventName as any, fixedData as any);
					}
				});
			});
		} finally {
			this._simulateEvent("loadEnd");
		}
	}

	private _handlers: {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} = {
		mapData: (data) => {
			this._set(this.data, 'mapData', data);

			if(data.writable != null) {
				this._set(this.state, 'readonly', data.writable == 0);
				this._set(this.state, 'writable', data.writable);
			}

			const id = this.state.writable == 2 ? data.adminId : this.state.writable == 1 ? data.writeId : data.id;
			if(id != null)
				this._set(this.state, 'mapId', id);
		},

		deleteMap: () => {
			this._set(this.state, 'readonly', true);
			this._set(this.state, 'writable', 0);
			this._set(this.state, 'deleted', true);
		},

		marker: (data) => {
			this._set(this.data.markers, data.id, data);
		},

		deleteMarker: (data) => {
			this._delete(this.data.markers, data.id);
		},

		line: (data) => {
			this._set(this.data.lines, data.id, {
				...data,
				trackPoints: this.data.lines[data.id]?.trackPoints || { length: 0 }
			});
		},

		deleteLine: (data) => {
			this._delete(this.data.lines, data.id);
		},

		linePoints: (data) => {
			const line = this.data.lines[data.id];
			if(line == null)
				return console.error("Received line points for non-existing line "+data.id+".");

			this._set(line, 'trackPoints', this._mergeTrackPoints(data.reset ? {} : line.trackPoints, data.trackPoints));
		},

		routePoints: (data) => {
			if(!this.data.route) {
				console.error("Received route points for non-existing route.");
				return;
			}

			this._set(this.data.route, 'trackPoints', this._mergeTrackPoints(this.data.route.trackPoints, data));
		},

		routePointsWithId: (data) => {
			const route = this.data.routes[data.routeId];
			if(!route) {
				console.error("Received route points for non-existing route.");
				return;
			}

			this._set(route, 'trackPoints', this._mergeTrackPoints(route.trackPoints, data.trackPoints));
		},

		view: (data) => {
			this._set(this.data.views, data.id, data);
		},

		deleteView: (data) => {
			this._delete(this.data.views, data.id);
			if (this.data.mapData) {
				if(this.data.mapData.defaultViewId == data.id)
					this._set(this.data.mapData, 'defaultViewId', null);
			}
		},

		type: (data) => {
			this._set(this.data.types, data.id, data);
		},

		deleteType: (data) => {
			this._delete(this.data.types, data.id);
		},

		disconnect: () => {
			this._set(this.state, 'disconnected', true);
			this._set(this.data, 'markers', { });
			this._set(this.data, 'lines', { });
			this._set(this.data, 'views', { });
			this._set(this.data, 'history', { });
		},

		connect: () => {
			this._set(this.state, 'disconnected', false); // Otherwise it gets set when mapData arrives

			if(this.state.mapId)
				this._setMapId(this.state.mapId).catch(() => undefined);

			// TODO: Handle errors

			if(this.state.bbox)
				this.updateBbox(this.state.bbox).catch((err) => { console.error("Error updating bbox.", err); });

			if(this.state.listeningToHistory) // TODO: Execute after setMapId() returns
				this.listenToHistory().catch(function(err) { console.error("Error listening to history", err); });

			if(this.data.route)
				this.setRoute(this.data.route).catch((err) => { console.error("Error setting route.", err); });
			for (const route of Object.values(this.data.routes))
				this.setRoute(route).catch((err) => { console.error("Error setting route.", err); });
		},

		connect_error: (err) => {
			if (!this.socket.active) { // Fatal error, client will not try to reconnect anymore
				this._set(this.state, 'serverError', err);
				this._simulateEvent("serverError", err);
			}
		},

		history: (data) => {
			this._set(this.data.history, data.id, data);
			// TODO: Limit to 50 entries
		},

		loadStart: () => {
			this._set(this.state, 'loading', this.state.loading + 1);
		},

		loadEnd: () => {
			this._set(this.state, 'loading', this.state.loading - 1);
		}
	};

	async setMapId(mapId: MapId): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		if(this.state.mapId != null)
			throw new Error("Map ID already set.");

		return await this._setMapId(mapId);
	}

	async setLanguage(language: SetLanguageRequest): Promise<void> {
		await this._emit("setLanguage", language);
	}

	async updateBbox(bbox: BboxWithZoom): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		const isZoomChange = this.bbox && bbox.zoom !== this.bbox.zoom;

		this._set(this.state, 'bbox', bbox);
		const obj = await this._emit("updateBbox", bbox);

		if (isZoomChange) {
			// Reset line points on zoom change to prevent us from accumulating too many unneeded line points.
			// On zoom change the line points are sent from the server without applying the "except" rule for the last bbox,
			// so we can be sure that we will receive all line points that are relevant for the new bbox.
			obj.linePoints = obj.linePoints || [];
			const linePointEventsById = new Map(obj.linePoints.map((e): [number, LinePointsEvent] => [e.id, e])); // Cannot use "as const" due to https://github.com/microsoft/rushstack/issues/3875
			for (const lineIdStr of Object.keys(this.data.lines)) {
				const lineId = Number(lineIdStr);
				const e = linePointEventsById.get(lineId);
				if (e) {
					e.reset = true;
				} else {
					obj.linePoints.push({
						id: lineId,
						trackPoints: [],
						reset: true
					});
				}
			}
		}

		this._receiveMultiple(obj);
		return obj;
	}

	async getMap(data: GetMapQuery): Promise<FindMapsResult | null> {
		return await this._emit("getMap", data);
	}

	async findMaps(data: FindMapsQuery): Promise<PagedResults<FindMapsResult>> {
		return await this._emit("findMaps", data);
	}

	async createMap(data: MapData<CRU.CREATE>): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		const obj = await this._emit("createMap", data);
		this._set(this.state, 'serverError', undefined);
		this._set(this.state, 'readonly', false);
		this._set(this.state, 'writable', 2);
		this._receiveMultiple(obj);
		return obj;
	}

	async editMap(data: MapData<CRU.UPDATE>): Promise<MapData> {
		return await this._emit("editMap", data);
	}

	async deleteMap(): Promise<void> {
		await this._emit("deleteMap");
	}

	async listenToHistory(): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		const obj = await this._emit("listenToHistory");
		this._set(this.state, 'listeningToHistory', true);
		this._receiveMultiple(obj);
		return obj;
	}

	async stopListeningToHistory(): Promise<void> {
		this._set(this.state, 'listeningToHistory', false);
		await this._emit("stopListeningToHistory");
	}

	async revertHistoryEntry(data: ObjectWithId): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		const obj = await this._emit("revertHistoryEntry", data);
		this._set(this.data, 'history', {});
		this._receiveMultiple(obj);
		return obj;
	}

	async getMarker(data: ObjectWithId): Promise<Marker> {
		const marker = await this._emit("getMarker", data);
		this._set(this.data.markers, marker.id, marker);
		return marker;
	}

	async addMarker(data: Marker<CRU.CREATE>): Promise<Marker> {
		const marker = await this._emit("addMarker", data);
		// If the marker is out of view, we will not recieve it in an event. Add it here manually to make sure that we have it.
		this._set(this.data.markers, marker.id, marker);
		return marker;
	}

	async editMarker(data: Marker<CRU.UPDATE> & { id: ID }): Promise<Marker> {
		return await this._emit("editMarker", data);
	}

	async deleteMarker(data: ObjectWithId): Promise<Marker> {
		return await this._emit("deleteMarker", data);
	}

	async getLineTemplate(data: LineTemplateRequest): Promise<LineTemplate> {
		return await this._emit("getLineTemplate", data);
	}

	async addLine(data: Line<CRU.CREATE>): Promise<Line> {
		return await this._emit("addLine", data);
	}

	async editLine(data: Line<CRU.UPDATE> & { id: ID }): Promise<Line> {
		return await this._emit("editLine", data);
	}

	async deleteLine(data: ObjectWithId): Promise<Line> {
		return await this._emit("deleteLine", data);
	}

	async exportLine(data: LineExportRequest): Promise<string> {
		return await this._emit("exportLine", data);
	}

	async find(data: FindQuery & { loadUrls?: false }): Promise<SearchResult[]>;
	async find(data: FindQuery & { loadUrls: true }): Promise<string | SearchResult[]>; // eslint-disable-line no-dupe-class-members
	async find(data: FindQuery): Promise<string | SearchResult[]> { // eslint-disable-line no-dupe-class-members
		return await this._emit("find", data);
	}

	async findOnMap(data: FindOnMapQuery): Promise<SocketResponse<SocketVersion.V3, 'findOnMap'>> {
		return await this._emit("findOnMap", data);
	}

	async getRoute(data: RouteRequest): Promise<RouteInfo> {
		return await this._emit("getRoute", data);
	}

	async setRoute(data: RouteCreate): Promise<RouteWithTrackPoints | undefined> {
		const route = await this._emit("setRoute", data);

		if(!route) // A newer submitted route has returned in the meantime
			return undefined;

		const result = {
			...route,
			trackPoints: this._mergeTrackPoints({}, route.trackPoints)
		};

		if (data.routeId)
			this._set(this.data.routes, data.routeId, result);
		else
			this._set(this.data, "route", result);

		this._simulateEvent("route", result);
		return result;
	}

	async clearRoute(data?: RouteClear): Promise<void> {
		if (data?.routeId) {
			this._delete(this.data.routes, data.routeId);
			this._simulateEvent("clearRoute", { routeId: data.routeId });
			await this._emit("clearRoute", data);
		} else if (this.data.route) {
			this._set(this.data, 'route', undefined);
			this._simulateEvent("clearRoute", { routeId: undefined });
			await this._emit("clearRoute", data);
		}
	}

	async lineToRoute(data: LineToRouteCreate): Promise<RouteWithTrackPoints | undefined> {
		const route = await this._emit("lineToRoute", data);

		if (!route) // A newer submitted route has returned in the meantime
			return undefined;

		const result = {
			...route,
			trackPoints: this._mergeTrackPoints({}, route.trackPoints)
		};

		if (data.routeId)
			this._set(this.data.routes, data.routeId, result);
		else
			this._set(this.data, "route", result);

		this._simulateEvent("route", result);
		return result;
	}

	async exportRoute(data: RouteExportRequest): Promise<string> {
		return await this._emit("exportRoute", data);
	}

	async addType(data: Type<CRU.CREATE>): Promise<Type> {
		return await this._emit("addType", data);
	}

	async editType(data: Type<CRU.UPDATE> & { id: ID }): Promise<Type> {
		return await this._emit("editType", data);
	}

	async deleteType(data: ObjectWithId): Promise<Type> {
		return await this._emit("deleteType", data);
	}

	async addView(data: View<CRU.CREATE>): Promise<View> {
		return await this._emit("addView", data);
	}

	async editView(data: View<CRU.UPDATE> & { id: ID }): Promise<View> {
		return await this._emit("editView", data);
	}

	async deleteView(data: ObjectWithId): Promise<View> {
		return await this._emit("deleteView", data);
	}

	async geoip(): Promise<Bbox | null> {
		return await this._emit("geoip");
	}

	disconnect(): void {
		this.socket.offAny();
		this.socket.disconnect();
	}

	private async _setMapId(mapId: string): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		this._set(this.state, 'serverError', undefined);
		this._set(this.state, 'mapId', mapId);
		try {
			const obj = await this._emit("setMapId", mapId);
			this._receiveMultiple(obj);
			return obj;
		} catch(err: any) {
			this._set(this.state, 'serverError', err);
			this._simulateEvent("serverError", err);
			throw err;
		}
	}

	private _receiveMultiple(obj?: MultipleEvents<ClientEvents>): void {
		if (obj) {
			for(const i of Object.keys(obj) as EventName<ClientEvents>[])
				(obj[i] as Array<ClientEvents[typeof i][0]>).forEach((it) => { this._simulateEvent(i, it as any); });
		}
	}

	private _simulateEvent<E extends EventName<ClientEvents>>(eventName: E, ...data: ClientEvents[E]): void {
		const fixedData = this._fixEventObject(eventName, data);

		const listeners = this.listeners[eventName] as Array<EventHandler<ClientEvents, E>> | undefined;
		if(listeners) {
			listeners.forEach(function(listener: EventHandler<ClientEvents, E>) {
				listener(...fixedData);
			});
		}
	}

	private _mergeTrackPoints(existingTrackPoints: Record<number, TrackPoint> | null, newTrackPoints: TrackPoint[]): TrackPoints {
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

	get disconnected(): boolean {
		return this.state.disconnected;
	}

	get server(): string {
		return this.state.server;
	}

	get mapId(): string | undefined {
		return this.state.mapId;
	}

	get bbox(): BboxWithZoom | undefined {
		return this.state.bbox;
	}

	get readonly(): boolean | undefined {
		return this.state.readonly;
	}

	get writable(): Writable | undefined {
		return this.state.writable;
	}

	get deleted(): boolean {
		return this.state.deleted;
	}

	get serverError(): Error | undefined {
		return this.state.serverError;
	}

	get loading(): number {
		return this.state.loading;
	}

	get listeningToHistory(): boolean {
		return this.state.listeningToHistory;
	}

	get mapData(): (MapData & { writable: Writable }) | undefined {
		return this.data.mapData;
	}

	get markers(): Record<ID, Marker> {
		return this.data.markers;
	}

	get lines(): Record<ID, LineWithTrackPoints> {
		return this.data.lines;
	}

	get views(): Record<ID, View> {
		return this.data.views;
	}

	get types(): Record<ID, Type> {
		return this.data.types;
	}

	get history(): Record<ID, HistoryEntry> {
		return this.data.history;
	}

	get route(): RouteWithTrackPoints | undefined {
		return this.data.route;
	}

	get routes(): Record<string, RouteWithTrackPoints> {
		return this.data.routes;
	}
}

export default Client;