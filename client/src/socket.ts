import { io, type ManagerOptions, type Socket as SocketIO, type SocketOptions } from "socket.io-client";
import { type Bbox, type BboxWithZoom, type CRU, type EventHandler, type EventName, type FindMapsResult, type ID, type Line, type SocketEvents, type Marker, type MultipleEvents, type MapData, type MapSlug, type PagedResults, type Route, type RouteClear, type RouteCreate, type RouteExportRequest, type RouteInfo, type RouteRequest, type SearchResult, type SocketVersion, type TrackPoint, type Type, type View, type Writable, type SocketClientToServerEvents, type SocketServerToClientEvents, MapNotFoundError, type SetLanguageRequest, type TrackPoints, type Api, ApiVersion, type PagingInput, type MapDataWithWritable, type AllMapObjectsPick, type StreamedResults, type AllAdminMapObjectsSubStream, type BboxWithExcept, type AllMapObjectsItem, type SocketApi, type StreamId, type FindOnMapResult, type HistoryEntry, type ExportFormat } from "facilmap-types";
import { deserializeError, errorConstructors, serializeError } from "serialize-error";
import { defaultReactiveObjectProvider, type ReactiveObjectProvider } from "./reactive";
import { streamToIterable } from "json-stream-es";

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

	emit: { [E in keyof SocketApi<SocketVersion.V3, false>]: [E, ...Parameters<SocketApi<SocketVersion.V3, false>[E]>] }[keyof SocketApi<SocketVersion.V3, false>];
	emitResolve: { [E in keyof SocketApi<SocketVersion.V3, false>]: [E, UndefinedToNull<Awaited<ReturnType<SocketApi<SocketVersion.V3, false>[E]>>>] }[keyof SocketApi<SocketVersion.V3, false>];
	emitReject: [keyof SocketApi<SocketVersion.V3, false>, Error];
}

export type ClientEvents = Pick<ClientEventsInterface, keyof ClientEventsInterface>; // Workaround for https://github.com/microsoft/TypeScript/issues/15300

const MANAGER_EVENTS: Array<EventName<ClientEvents>> = ['error', 'reconnect', 'reconnect_attempt', 'reconnect_error', 'reconnect_failed'];

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
	routes: Record<string, Route>;
}

// Socket.io converts undefined to null.
type UndefinedToNull<T> = undefined extends T ? Exclude<T, undefined> | null : T;

errorConstructors.set("MapNotFoundError", MapNotFoundError as any);

class Client implements Api<ApiVersion.V3> {
	protected reactiveObjectProvider;
	protected socket: SocketIO<SocketServerToClientEvents<SocketVersion.V3>, SocketClientToServerEvents<SocketVersion.V3, false>>;
	protected state: ClientState;
	protected streams: Record<string, { handleChunks: (chunks: any[]) => void; handleDone: () => void }> = {};

	private listeners: {
		[E in EventName<ClientEvents>]?: Array<EventHandler<ClientEvents, E>>
	} = { };

	constructor(server: string, mapId?: string, options?: Partial<ManagerOptions & SocketOptions> & {
		reactiveObjectProvider?: ReactiveObjectProvider;
	}) {
		this.reactiveObjectProvider = options?.reactiveObjectProvider ?? defaultReactiveObjectProvider;
		this.state = this.reactiveObjectProvider.create({
			disconnected: true,
			server,
			mapId,
			bbox: undefined,
			readonly: undefined,
			writable: undefined,
			deleted: false,
			serverError: undefined,
			loading: 0,
			listeningToHistory: false,
			routes: {}
		});

		const serverUrl = typeof location != "undefined" ? new URL(this.state.server, location.href) : new URL(this.state.server);
		const socket = io(`${serverUrl.origin}/v3`, {
			forceNew: true,
			path: serverUrl.pathname.replace(/\/$/, "") + "/socket.io",
			...options
		});
		this.socket = socket;

		for(const [i, handler] of Object.entries(this._getEventHandlers())) {
			this.on(i as any, handler as any);
		}

		void Promise.resolve().then(() => {
			this._emit("loadStart");
		});

		this.once("connect", () => {
			this._emit("loadEnd");
		});
	}

	protected _decodeData(data: Record<string, string>): Record<string, string> {
		const result = Object.create(null);
		Object.assign(result, data);
		return result;
	}

	protected _fixResponseObject<T>(requestName: keyof SocketApi<SocketVersion.V3, false>, obj: T): T {
		if (typeof obj != "object" || !(obj as any)?.data || !["getMarker", "addMarker", "editMarker", "deleteMarker", "getLineTemplate", "addLine", "editLine", "deleteLine"].includes(requestName))
			return obj;

		return {
			...obj,
			data: this._decodeData((obj as any).data)
		};
	}

	protected _fixEventObject<T extends any[]>(eventName: EventName<ClientEvents>, obj: T): T {
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

	protected _handleStream(streamId: StreamId): ReadableStream<any> {
		const stream = new TransformStream();
		const writer = stream.writable.getWriter();
		this.streams[streamId] = {
			handleChunks: (chunks) => {
				for (const chunk of chunks) {
					void writer.write(chunk);
				}
			},
			handleDone: () => {
				void writer.close();
				delete this.streams[streamId];
			}
		};
		return stream.readable;
	}

	on<E extends EventName<ClientEvents>>(eventName: E, fn: EventHandler<ClientEvents, E>): void {
		if(!this.listeners[eventName]) {
			(MANAGER_EVENTS.includes(eventName) ? this.socket.io as any : this.socket)
				.on(eventName, (...[data]: ClientEvents[E]) => { this._emit(eventName as any, data); });
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

	protected async _call<R extends keyof SocketApi<SocketVersion.V3, false>>(
		eventName: R,
		...args: Parameters<SocketApi<SocketVersion.V3, false>[R]>
	): Promise<ReturnType<SocketApi<SocketVersion.V3, false>[R]> extends Promise<infer Result> ? UndefinedToNull<Result> : never> {
		try {
			this._emit("loadStart");

			this._emit("emit", eventName as any, args as any);

			const outerError = new Error();
			return await new Promise((resolve, reject) => {
				this.socket.emit(eventName as any, args, (err: any, data: any) => {
					if(err) {
						const cause = deserializeError(err);
						reject(deserializeError({ ...serializeError(outerError), message: cause.message, cause }));
						this._emit("emitReject", eventName as any, err);
					} else {
						const fixedData = this._fixResponseObject(eventName, data);
						resolve(fixedData);
						this._emit("emitResolve", eventName as any, fixedData);
					}
				});
			});
		} finally {
			this._emit("loadEnd");
		}
	}

	protected _getEventHandlers(): {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} {
		return {
			mapData: (data) => {
				if(data.writable != null) {
					this.reactiveObjectProvider.set(this.state, 'readonly', data.writable == 0);
					this.reactiveObjectProvider.set(this.state, 'writable', data.writable);
				}

				const id = this.state.writable == 2 ? data.adminId : this.state.writable == 1 ? data.writeId : data.id;
				if(id != null)
					this.reactiveObjectProvider.set(this.state, 'mapId', id);
			},

			deleteMap: () => {
				this.reactiveObjectProvider.set(this.state, 'readonly', true);
				this.reactiveObjectProvider.set(this.state, 'writable', 0);
				this.reactiveObjectProvider.set(this.state, 'deleted', true);
			},

			disconnect: () => {
				this.reactiveObjectProvider.set(this.state, 'disconnected', true);
			},

			connect: () => {
				this.reactiveObjectProvider.set(this.state, 'disconnected', false); // Otherwise it gets set when mapData arrives

				if(this.state.mapId)
					this._setMapId(this.state.mapId).catch(() => undefined);

				// TODO: Handle errors

				if(this.state.bbox)
					this.updateBbox(this.state.bbox).catch((err) => { console.error("Error updating bbox.", err); });

				if(this.state.listeningToHistory) // TODO: Execute after setMapId() returns
					this.listenToHistory().catch(function(err) { console.error("Error listening to history", err); });

				for (const route of Object.values(this.state.routes))
					this.setRoute(route).catch((err) => { console.error("Error setting route.", err); });
			},

			connect_error: (err) => {
				if (!this.socket.active) { // Fatal error, client will not try to reconnect anymore
					this.reactiveObjectProvider.set(this.state, 'serverError', err);
					this._emit("serverError", err);
				}
			},

			loadStart: () => {
				this.reactiveObjectProvider.set(this.state, 'loading', this.state.loading + 1);
			},

			loadEnd: () => {
				this.reactiveObjectProvider.set(this.state, 'loading', this.state.loading - 1);
			}
		};
	};

	async setMapId(mapId: MapSlug): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		if(this.state.mapId != null)
			throw new Error("Map ID already set.");

		return await this._setMapId(mapId);
	}

	async setLanguage(language: SetLanguageRequest): Promise<void> {
		await this._call("setLanguage", language);
	}

	// Overridden by StoringClient
	protected async _updateBbox(bbox: BboxWithZoom): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		this.reactiveObjectProvider.set(this.state, 'bbox', bbox);
		return await this._call("updateBbox", bbox);
	}

	async updateBbox(bbox: BboxWithZoom): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		const obj = await this._updateBbox(bbox);
		this._emitMultiple(obj);
		return obj;
	}

	async findMaps(query: string, paging?: PagingInput): Promise<PagedResults<FindMapsResult>> {
		return await this._call("findMaps", query, paging);
	}

	async getMap(mapSlug: string): Promise<MapDataWithWritable> {
		return await this._call("getMap", mapSlug);
	}

	async createMap<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<StreamedResults<AllAdminMapObjectsSubStream<Pick>>> {
		const result = await this._call("createMap", data, options);
		// this.reactiveObjectProvider.set(this.state, 'serverError', undefined);
		// this.reactiveObjectProvider.set(this.state, 'readonly', false);
		// this.reactiveObjectProvider.set(this.state, 'writable', 2);
		// this._emitMultiple(result);
		return {
			results: streamToIterable(this._handleStream(result.results))
		};
	}

	async updateMap(mapSlug: MapSlug, data: MapData<CRU.UPDATE>): Promise<MapDataWithWritable> {
		return await this._call("updateMap", mapSlug, data);
	}

	async deleteMap(mapSlug: MapSlug): Promise<void> {
		await this._call("deleteMap", mapSlug);
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick>(mapSlug: MapSlug, options: { pick: Pick[]; bbox?: BboxWithExcept }): Promise<StreamedResults<AllMapObjectsItem<Pick>>> {
		const result = await this._call("getAllMapObjects", mapSlug, options);
		return {
			results: streamToIterable(this._handleStream(result.results))
		};
	}

	async findOnMap(mapSlug: MapSlug, query: string): Promise<FindOnMapResult[]> {
		return await this._call("findOnMap", mapSlug, query);
	}

	async getHistory(mapSlug: MapSlug, data?: PagingInput): Promise<HistoryEntry[]> {
		return await this._call("getHistory", mapSlug, data);
	}

	async revertHistoryEntry(mapSlug: MapSlug, historyEntryId: ID): Promise<void> {
		await this._call("revertHistoryEntry", mapSlug, historyEntryId);
		this.reactiveObjectProvider.set(this.data, 'history', {});
		this._emitMultiple(obj);
		return obj;
	}

	async getMapMarkers(mapSlug: MapSlug, options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Marker>> {
		const result = await this._call("getMapMarkers", mapSlug, options);
		return {
			results: streamToIterable(this._handleStream(result.results))
		};
	}

	async getMarker(mapSlug: MapSlug, markerId: ID): Promise<Marker> {
		const marker = await this._call("getMarker", mapSlug, markerId);
		this.reactiveObjectProvider.set(this.data.markers, marker.id, marker);
		return marker;
	}

	async createMarker(mapSlug: MapSlug, data: Marker<CRU.CREATE>): Promise<Marker> {
		const marker = await this._call("createMarker", mapSlug, data);
		// If the marker is out of view, we will not recieve it in an event. Add it here manually to make sure that we have it.
		this.reactiveObjectProvider.set(this.data.markers, marker.id, marker);
		return marker;
	}

	async updateMarker(mapSlug: MapSlug, markerId: ID, data: Marker<CRU.UPDATE>): Promise<Marker> {
		return await this._call("updateMarker", mapSlug, markerId);
	}

	async deleteMarker(mapSlug: MapSlug, markerId: ID): Promise<void> {
		await this._call("deleteMarker", mapSlug, markerId);
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: MapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>> {
		const result = await this._call("getMapLines", mapSlug, options);
		return {
			results: streamToIterable(this._handleStream(result.results))
		};
	}

	async getLine(mapSlug: MapSlug, lineId: ID): Promise<Line> {
		return await this._call("getLine", mapSlug, lineId);
	}

	async getLinePoints(mapSlug: MapSlug, lineId: ID, options?: { bbox?: BboxWithZoom & { except?: Bbox } }): Promise<StreamedResults<TrackPoint>> {
		const result = await this._call("getLinePoints", mapSlug, lineId, options);
		return {
			results: streamToIterable(this._handleStream(result.results))
		};
	}

	async createLine(mapSlug: MapSlug, data: Line<CRU.CREATE>): Promise<Line> {
		return await this._call("createLine", mapSlug, data);
	}

	async updateLine(mapSlug: MapSlug, lineId: ID, data: Line<CRU.UPDATE>): Promise<Line> {
		return await this._call("updateLine", mapSlug, lineId, data);
	}

	async deleteLine(mapSlug: MapSlug, lineId: ID): Promise<void> {
		await this._call("deleteLine", mapSlug, lineId);
	}

	async exportLine(mapSlug: MapSlug, lineId: ID, options: { format: ExportFormat }): Promise<{ type: string; filename: string; data: ReadableStream<string> }> {
		const result = await this._call("exportLine", mapSlug, lineId, options);
		return {
			...result,
			data: this._handleStream(result.data)
		};
	}

	async getMapTypes(mapSlug: MapSlug): Promise<StreamedResults<Type>> {
		const result = await this._call("getMapTypes", mapSlug);
		return {
			results: streamToIterable(this._handleStream(result.results))
		};
	}

	async getType(mapSlug: MapSlug, typeId: ID): Promise<Type> {
		return await this._call("getType", mapSlug, typeId);
	}

	async createType(mapSlug: MapSlug, data: Type<CRU.CREATE>): Promise<Type> {
		return await this._call("createType", mapSlug, data);
	}

	async updateType(mapSlug: MapSlug, typeId: ID, data: Type<CRU.UPDATE>): Promise<Type> {
		return await this._call("updateType", mapSlug, typeId, data);
	}

	async deleteType(mapSlug: MapSlug, typeId: ID): Promise<void> {
		await this._call("deleteType", mapSlug, typeId);
	}

	async getMapViews(mapSlug: MapSlug): Promise<StreamedResults<View>> {
		const result = await this._call("getMapViews", mapSlug);
		return {
			results: streamToIterable(this._handleStream(result.results))
		};
	}

	async getView(mapSlug: MapSlug, viewId: ID): Promise<View> {
		return await this._call("getView", mapSlug, viewId);
	}

	async createView(mapSlug: MapSlug, data: View<CRU.CREATE>): Promise<View> {
		return await this._call("createView", mapSlug, data);
	}

	async updateView(mapSlug: MapSlug, viewId: ID, data: View<CRU.UPDATE>): Promise<View> {
		return await this._call("updateView", mapSlug, viewId, data);
	}

	async deleteView(mapSlug: MapSlug, viewId: ID): Promise<void> {
		await this._call("deleteView", mapSlug, viewId);
	}

	async find(query: string): Promise<SearchResult[]> {
		return await this._call("find", query);
	}

	async findUrl(url: string): Promise<{ data: ReadableStream<string> }> {
		const result = await this._call("findUrl", url);
		return {
			data: this._handleStream(result.data)
		};
	}

	async getRoute(data: RouteRequest): Promise<RouteInfo> {
		return await this._call("getRoute", data);
	}

	async geoip(): Promise<Bbox | undefined> {
		return (await this._call("geoip")) ?? undefined;
	}

	async setRoute(data: RouteCreate): Promise<RouteWithTrackPoints | undefined> {
		const route = await this._call("setRoute", data);

		if(!route) // A newer submitted route has returned in the meantime
			return undefined;

		const result = {
			...route,
			trackPoints: this._mergeTrackPoints({}, route.trackPoints)
		};

		if (data.routeId)
			this.reactiveObjectProvider.set(this.data.routes, data.routeId, result);
		else
			this.reactiveObjectProvider.set(this.data, "route", result);

		this._emit("route", result);
		return result;
	}

	async clearRoute(data?: RouteClear): Promise<void> {
		if (data?.routeId) {
			this.reactiveObjectProvider.delete(this.data.routes, data.routeId);
			this._emit("clearRoute", { routeId: data.routeId });
			await this._call("clearRoute", data);
		} else if (this.data.route) {
			this.reactiveObjectProvider.set(this.data, 'route', undefined);
			this._emit("clearRoute", { routeId: undefined });
			await this._call("clearRoute", data);
		}
	}

	async lineToRoute(data: LineToRouteCreate): Promise<RouteWithTrackPoints | undefined> {
		const route = await this._call("lineToRoute", data);

		if (!route) // A newer submitted route has returned in the meantime
			return undefined;

		const result = {
			...route,
			trackPoints: this._mergeTrackPoints({}, route.trackPoints)
		};

		if (data.routeId)
			this.reactiveObjectProvider.set(this.data.routes, data.routeId, result);
		else
			this.reactiveObjectProvider.set(this.data, "route", result);

		this._emit("route", result);
		return result;
	}

	async exportRoute(data: RouteExportRequest): Promise<string> {
		return await this._call("exportRoute", data);
	}

	async listenToHistory(): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		const obj = await this._call("listenToHistory");
		this.reactiveObjectProvider.set(this.state, 'listeningToHistory', true);
		this._emitMultiple(obj);
		return obj;
	}

	async stopListeningToHistory(): Promise<void> {
		this.reactiveObjectProvider.set(this.state, 'listeningToHistory', false);
		await this._call("stopListeningToHistory");
	}

	disconnect(): void {
		this.socket.offAny();
		this.socket.disconnect();
	}

	private async _setMapId(mapId: string): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		this.reactiveObjectProvider.set(this.state, 'serverError', undefined);
		this.reactiveObjectProvider.set(this.state, 'mapId', mapId);
		try {
			const obj = await this._call("setMapId", mapId);
			this._emitMultiple(obj);
			return obj;
		} catch(err: any) {
			this.reactiveObjectProvider.set(this.state, 'serverError', err);
			this._emit("serverError", err);
			throw err;
		}
	}

	private _emitMultiple(obj?: MultipleEvents<ClientEvents>): void {
		if (obj) {
			for(const i of Object.keys(obj) as EventName<ClientEvents>[])
				(obj[i] as Array<ClientEvents[typeof i][0]>).forEach((it) => { this._emit(i, it as any); });
		}
	}

	protected _emit<E extends EventName<ClientEvents>>(eventName: E, ...data: ClientEvents[E]): void {
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
}

export default Client;
