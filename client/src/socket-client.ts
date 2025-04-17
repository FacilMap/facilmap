import { io, type ManagerOptions, type Socket as SocketIO, type SocketOptions } from "socket.io-client";
import {
	type Bbox, type BboxWithZoom, type CRU, type EventHandler, type EventName, type FindMapsResult, type ID, type Line, type SocketEvents,
	type Marker, type MapData, type MapSlug, type PagedResults, type RouteInfo, type RouteRequest,
	type SearchResult, type SocketVersion, type TrackPoint, type Type, type View, type SocketClientToServerEvents,
	type SocketServerToClientEvents, type SetLanguageRequest, type PagingInput, type MapDataWithWritable,
	type AllMapObjectsPick, type StreamedResults, type BboxWithExcept, type AllMapObjectsItem, type SocketApi, type StreamId,
	type FindOnMapResult, type HistoryEntry, type StreamToStreamId,
	type RouteParameters, type LineToRouteRequest, type ApiV3, type AllAdminMapObjectsItem,
	type LineWithTrackPoints,
	type DeepReadonly,
	type SubscribeToMapOptions,
	ApiVersion,
	type Api,
	type ExportFormat,
	type AllAdminMapObjects,
	type AllMapObjects,
	type LineTemplate
} from "facilmap-types";
import { deserializeError, serializeError } from "serialize-error";
import { DefaultReactiveObjectProvider, _defineDynamicGetters, type ReactiveObjectProvider } from "./reactivity";
import { streamToIterable } from "json-stream-es";
import { mapNestedIterable, mergeObjectWithPromise, unstreamMapObjects, type BasicPromise } from "./utils";
import { EventEmitter } from "./events";
import { MapSubscriptionStateType, SocketClientCreateMapSubscription, SocketClientMapSubscription } from "./socket-client-map-subscription";
import { SocketClientRouteSubscription } from "./socket-client-route-subscription";
import { SubscriptionStateType } from "./socket-client-subscription";

export interface ClientEventsInterface extends SocketEvents<SocketVersion.V3> {
	connect: [];
	disconnect: [string];
	connect_error: [Error];

	error: [Error];
	reconnect: [number];
	reconnect_attempt: [number];
	reconnect_error: [Error];
	reconnect_failed: [];

	fatalError: [Error];

	operationStart: [];
	operationEnd: [];

	emit: {
		[E in keyof SocketApi<SocketVersion.V3, false>]: [E, {
			args: Parameters<SocketApi<SocketVersion.V3, false>[E]>;
			result: ReturnType<SocketApi<SocketVersion.V3, false>[E]>;
		}]
	}[keyof SocketApi<SocketVersion.V3, false>];
}

export type ClientEvents = Pick<ClientEventsInterface, keyof ClientEventsInterface>; // Workaround for https://github.com/microsoft/TypeScript/issues/15300

const MANAGER_EVENTS: Array<EventName<ClientEvents>> = ['error', 'reconnect', 'reconnect_attempt', 'reconnect_error', 'reconnect_failed'];

export enum ClientStateType {
	/** The client has been set up and is not connected yes. Usually this means that it is currently connecting (unless autoConnect was set to false). */
	INITIAL = "initial",
	/** The client is connected. */
	CONNECTED = "connected",
	/** The socket connection has been lost and is currently trying to reconnect. */
	RECONNECTING = "reconnecting",
	/** The socket connection has been lost and has given up trying to reconnect. */
	FATAL_ERROR = "fatal_error"
};

export type ClientState = (
	| { type: ClientStateType.INITIAL | ClientStateType.CONNECTED | ClientStateType.RECONNECTING }
	| { type: ClientStateType.FATAL_ERROR; error: Error }
);

interface ClientData {
	state: DeepReadonly<ClientState>;
	server: string;
	bbox: DeepReadonly<BboxWithZoom> | undefined;
	mapSubscriptions: Record<MapSlug, SocketClientMapSubscription>;
	routeSubscriptions: Record<string, SocketClientRouteSubscription>;
	runningOperations: number;
}

type StreamHandler = {
	readable: ReadableStream<any>;
	handleChunks: (chunks: any[]) => void;
	handleDone: () => void;
	handleError: (error: Error) => void;
};

// Socket.io converts undefined to null.
type UndefinedToNull<T> = undefined extends T ? Exclude<T, undefined> | null : T;

export interface SocketClient extends Readonly<ClientData> {
	// Getters are created in constructor
}

export class SocketClient extends EventEmitter<ClientEvents> implements Api<ApiVersion.V3, false> {
	reactiveObjectProvider: ReactiveObjectProvider;
	connectPromise: Promise<this>;

	protected socket: SocketIO<SocketServerToClientEvents<SocketVersion.V3>, SocketClientToServerEvents<SocketVersion.V3, false>>;
	protected data: ClientData;
	protected streams: Record<string, StreamHandler> = {};

	constructor(server: string, options?: Partial<ManagerOptions & SocketOptions & { reactiveObjectProvider?: ReactiveObjectProvider }>) {
		super();

		this.reactiveObjectProvider = options?.reactiveObjectProvider ?? new DefaultReactiveObjectProvider();

		this.data = this.reactiveObjectProvider.makeReactive({
			state: { type: ClientStateType.INITIAL },
			server,
			bbox: undefined,
			mapSubscriptions: Object.create(null),
			routeSubscriptions: Object.create(null),
			runningOperations: 0
		});

		_defineDynamicGetters(this, this.data, this.reactiveObjectProvider);

		const serverUrl = typeof location != "undefined" ? new URL(this.data.server, location.href) : new URL(this.data.server);
		const socket = io(`${serverUrl.origin}/v3`, {
			forceNew: true,
			path: serverUrl.pathname.replace(/\/$/, "") + "/socket.io",
			...options
		});
		this.socket = socket;

		for(const [i, handler] of Object.entries(this._getEventHandlers())) {
			this.on(i as any, handler as any);
		}

		this.connectPromise = new Promise<void>((resolve, reject) => {
			const handleConnect = () => {
				cleanup();
				resolve();
			};
			const handleFatalError = (err: Error) => {
				cleanup();
				reject(err);
			};
			const cleanup = () => {
				this.removeListener("connect", handleConnect);
				this.removeListener("fatalError", handleFatalError);
			};
			this.on("connect", handleConnect);
			this.on("fatalError", handleFatalError);
		}).then(() => this);

		void Promise.resolve().then(() => {
			this._emit("operationStart");
			return this.connectPromise;
		}).finally(() => {
			this._emit("operationEnd");
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

	protected _getStream(streamId: StreamId<any>): StreamHandler {
		if (!this.streams[streamId]) {
			const stream = new TransformStream();
			const reader = stream.readable.getReader();
			const writer = stream.writable.getWriter();
			this.streams[streamId] = {
				readable: new ReadableStream({
					pull: async (controller) => {
						const { done, value } = await reader.read();
						if (done) {
							controller.close();
							delete this.streams[streamId];
						} else {
							controller.enqueue(value);
						}
					},
					cancel: async (reason) => {
						try {
							await Promise.allSettled([
								reader.cancel(reason),
								this._abortStream(streamId)
							]);
						} finally {
							delete this.streams[streamId];
						}
					}
				}),
				handleChunks: (chunks) => {
					for (const chunk of chunks) {
						writer.write(chunk).catch(() => undefined);
					}
				},
				handleDone: () => {
					writer.close().catch(() => undefined);
				},
				handleError: (err) => {
					writer.abort(err).catch(() => undefined);
				}
			};
		}
		return this.streams[streamId];
	}

	protected _handleStream<S extends StreamId<any>>(streamId: S): ReadableStream<S extends StreamId<infer T> ? T : never> {
		return this._getStream(streamId).readable;
	}

	protected _handleIterable<S extends StreamId<any>>(streamId: S): AsyncIterable<S extends StreamId<infer T> ? T : never, void, undefined> {
		return streamToIterable(this._handleStream(streamId));
	}

	protected async _abortStream(streamId: StreamId<any>): Promise<void> {
		await this._call("abortStream", streamId);
	}

	hasActiveMapSubscription(mapSlug: MapSlug): boolean {
		return !!this.data.mapSubscriptions[mapSlug] && ![
			SubscriptionStateType.UNSUBSCRIBED,
			SubscriptionStateType.FATAL_ERROR,
			MapSubscriptionStateType.DELETED
		].includes(this.data.mapSubscriptions[mapSlug].state.type);
	}

	hasActiveRouteSubscription(routeKey: string): boolean {
		return !!this.data.routeSubscriptions[routeKey] && ![
			SubscriptionStateType.UNSUBSCRIBED,
			SubscriptionStateType.FATAL_ERROR
		].includes(this.data.routeSubscriptions[routeKey].state.type);
	}

	on<E extends EventName<ClientEvents>>(eventName: E, fn: EventHandler<ClientEvents, E>): void {
		if (!this._hasListeners(eventName)) {
			(MANAGER_EVENTS.includes(eventName) ? this.socket.io as any : this.socket)
				.on(eventName, (...data: ClientEvents[E]) => { this._emit(eventName as any, ...data); });
		}

		super.on(eventName, fn);
	}

	protected async _call<R extends keyof SocketApi<SocketVersion.V3, false>>(
		eventName: R,
		...args: DeepReadonly<Parameters<SocketApi<SocketVersion.V3, false>[R]>>
	): Promise<StreamToStreamId<ReturnType<SocketApi<SocketVersion.V3, false>[R]>> extends Promise<infer Result> ? UndefinedToNull<Result> : never> {
		if (this.state.type === ClientStateType.FATAL_ERROR) {
			throw this.state.error;
		}

		try {
			this._emit("operationStart");

			const outerError = new Error();
			let result = new Promise<any>((resolve, reject) => {
				this.socket.emit(eventName as any, ...args, (err: any, data: any) => {
					if(err) {
						const cause = deserializeError(err);
						reject(deserializeError({ ...serializeError(outerError), message: cause.message, status: (cause as any).status, cause }));
					} else {
						const fixedData = this._fixResponseObject(eventName, data);
						resolve(fixedData);
					}
				});
			});
			this._emit("emit", eventName as any, { args: args as any, result });
			return await result;
		} finally {
			this._emit("operationEnd");
		}
	}

	protected _getEventHandlers(): {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} {
		return {
			disconnect: () => {
				this.reactiveObjectProvider.set(this.data, 'state', {
					type: ClientStateType.RECONNECTING
				});
			},

			connect: async () => {
				this.reactiveObjectProvider.set(this.data, 'state', {
					type: ClientStateType.CONNECTED
				});

				if (this.data.bbox) {
					this.setBbox(this.data.bbox).catch((err) => { console.error("Error updating bbox.", err); });
				}
			},

			connect_error: (err) => {
				if (!this.socket.active) { // Fatal error, client will not try to reconnect anymore
					this.reactiveObjectProvider.set(this.data, 'state', {
						type: ClientStateType.FATAL_ERROR,
						error: err as any
					});
					this._emit("fatalError", err);
				}
			},

			operationStart: () => {
				this.reactiveObjectProvider.set(this.data, 'runningOperations', this.data.runningOperations + 1);
			},

			operationEnd: () => {
				this.reactiveObjectProvider.set(this.data, 'runningOperations', this.data.runningOperations - 1);
			},

			streamChunks: (streamId, chunks) => {
				this._getStream(streamId).handleChunks(chunks);
			},

			streamDone: (streamId) => {
				this._getStream(streamId).handleDone();
			},

			streamError: (streamId, error) => {
				this._getStream(streamId).handleError(deserializeError(error));
			}
		};
	};

	async findMaps(query: string, paging?: PagingInput): Promise<PagedResults<FindMapsResult>> {
		return await this._call("findMaps", query, paging);
	}

	async getMap(mapSlug: string): Promise<MapDataWithWritable> {
		return await this._call("getMap", mapSlug);
	}

	async createMap<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<AsyncIterable<AllAdminMapObjectsItem<Pick>, void, undefined>> {
		const result = await this._call("createMap", data, options);
		return mapNestedIterable(this._handleIterable(result), (obj) => ({ ...obj, data: this._handleIterable<any>(obj.data) } as AllAdminMapObjectsItem<Pick>));
	}

	async createMapUnstreamed<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<AllAdminMapObjects<Pick>> {
		return await unstreamMapObjects(await this.createMap(data, options));
	}

	async updateMap(mapSlug: MapSlug, data: MapData<CRU.UPDATE>): Promise<MapDataWithWritable> {
		return await this._call("updateMap", mapSlug, data);
	}

	async deleteMap(mapSlug: MapSlug): Promise<void> {
		await this._call("deleteMap", mapSlug);
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick>(mapSlug: MapSlug, options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<AsyncIterable<AllMapObjectsItem<Pick>, void, undefined>> {
		const result = await this._call("getAllMapObjects", mapSlug, options);
		return mapNestedIterable(this._handleIterable(result), (obj) => ({ ...obj, data: this._handleIterable<any>(obj.data) } as AllMapObjectsItem<Pick>));
	}

	async getAllMapObjectsUnstreamed<Pick extends AllMapObjectsPick>(mapSlug: MapSlug, options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<AllMapObjects<Pick>> {
		return await unstreamMapObjects(await this.getAllMapObjects(mapSlug, options));
	}

	async findOnMap(mapSlug: MapSlug, query: string): Promise<FindOnMapResult[]> {
		return await this._call("findOnMap", mapSlug, query);
	}

	async getHistory(mapSlug: MapSlug, data?: PagingInput): Promise<PagedResults<HistoryEntry>> {
		return await this._call("getHistory", mapSlug, data);
	}

	async revertHistoryEntry(mapSlug: MapSlug, historyEntryId: ID): Promise<void> {
		await this._call("revertHistoryEntry", mapSlug, historyEntryId);
	}

	async getMapMarkers(mapSlug: MapSlug, options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Marker>> {
		const result = await this._call("getMapMarkers", mapSlug, options);
		return {
			results: this._handleIterable(result.results)
		};
	}

	async getMarker(mapSlug: MapSlug, markerId: ID): Promise<Marker> {
		return await this._call("getMarker", mapSlug, markerId);
	}

	async createMarker(mapSlug: MapSlug, data: Marker<CRU.CREATE>): Promise<Marker> {
		return await this._call("createMarker", mapSlug, data);
	}

	async updateMarker(mapSlug: MapSlug, markerId: ID, data: Marker<CRU.UPDATE>): Promise<Marker> {
		return await this._call("updateMarker", mapSlug, markerId, data);
	}

	async deleteMarker(mapSlug: MapSlug, markerId: ID): Promise<void> {
		await this._call("deleteMarker", mapSlug, markerId);
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: MapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>> {
		const result = await this._call("getMapLines", mapSlug, options);
		return {
			results: this._handleIterable(result.results) as AsyncIterable<IncludeTrackPoints extends true ? LineWithTrackPoints : Line, void, undefined>
		};
	}

	async getLine(mapSlug: MapSlug, lineId: ID): Promise<Line> {
		return await this._call("getLine", mapSlug, lineId);
	}

	async getLinePoints(mapSlug: MapSlug, lineId: ID, options?: { bbox?: BboxWithZoom & { except?: Bbox } }): Promise<StreamedResults<TrackPoint>> {
		const result = await this._call("getLinePoints", mapSlug, lineId, options);
		return {
			results: this._handleIterable(result.results)
		};
	}

	async createLine(mapSlug: MapSlug, data: DeepReadonly<Line<CRU.CREATE>>): Promise<Line> {
		return await this._call("createLine", mapSlug, data);
	}

	async updateLine(mapSlug: MapSlug, lineId: ID, data: DeepReadonly<Line<CRU.UPDATE>>): Promise<Line> {
		return await this._call("updateLine", mapSlug, lineId, data);
	}

	async deleteLine(mapSlug: MapSlug, lineId: ID): Promise<void> {
		await this._call("deleteLine", mapSlug, lineId);
	}

	async exportLine(mapSlug: MapSlug, lineId: ID, options: { format: ExportFormat }): Promise<{ type: string; filename: string; data: ReadableStream<Uint8Array> }> {
		const result = await this._call("exportLine", mapSlug, lineId, options);
		return {
			...result,
			data: this._handleStream(result.data)
		};
	}

	async getLineTemplate(mapSlug: MapSlug, options: { typeId: ID }): Promise<LineTemplate> {
		return await this._call("getLineTemplate", mapSlug, options);
	}

	async getMapTypes(mapSlug: MapSlug): Promise<StreamedResults<Type>> {
		const result = await this._call("getMapTypes", mapSlug);
		return {
			results: this._handleIterable(result.results)
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
			results: this._handleIterable(result.results)
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

	async findUrl(url: string): Promise<{ data: ReadableStream<Uint8Array> }> {
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

	async _subscribeToMap(mapSlug: MapSlug, options?: DeepReadonly<SubscribeToMapOptions>): Promise<void> {
		await this._call("subscribeToMap", mapSlug, options);
	}

	subscribeToMap(mapSlug: MapSlug, options?: SubscribeToMapOptions): SocketClientMapSubscription & BasicPromise<SocketClientMapSubscription> {
		if (this.hasActiveMapSubscription(mapSlug)) {
			throw new Error(`There is already a subscription to map ${mapSlug}.`);
		}

		const subscription = new SocketClientMapSubscription(this, mapSlug, {
			reactiveObjectProvider: this.reactiveObjectProvider,
			...options
		});
		this.reactiveObjectProvider.set(this.data.mapSubscriptions, mapSlug, this.reactiveObjectProvider.makeUnreactive(subscription));
		return mergeObjectWithPromise(subscription, subscription.subscribePromise);
	}

	async _createMapAndSubscribe(data: MapData<CRU.CREATE>, options?: DeepReadonly<SubscribeToMapOptions>): Promise<void> {
		await this._call("createMapAndSubscribe", data, options);
	}

	createMapAndSubscribe(data: MapData<CRU.CREATE>, options?: SubscribeToMapOptions): SocketClientMapSubscription & BasicPromise<SocketClientMapSubscription> {
		if (this.hasActiveMapSubscription(data.adminId)) {
			throw new Error(`There is already a subscription to map ${data.adminId}.`);
		}

		const subscription = new SocketClientCreateMapSubscription(this, data, {
			reactiveObjectProvider: this.reactiveObjectProvider,
			...options
		});
		this.reactiveObjectProvider.set(this.data.mapSubscriptions, data.adminId, this.reactiveObjectProvider.makeUnreactive(subscription));
		return mergeObjectWithPromise(subscription, subscription.subscribePromise);
	}

	async _unsubscribeFromMap(mapSlug: MapSlug): Promise<void> {
		this.reactiveObjectProvider.delete(this.data.mapSubscriptions, mapSlug);
		await this._call("unsubscribeFromMap", mapSlug);
	}

	async _subscribeToRoute(routeKey: string, params: DeepReadonly<RouteParameters | LineToRouteRequest>): Promise<void> {
		await this._call("subscribeToRoute", routeKey, params);
	}

	subscribeToRoute(routeKey: string, params: DeepReadonly<RouteParameters | LineToRouteRequest>): SocketClientRouteSubscription & BasicPromise<SocketClientRouteSubscription> {
		if (this.hasActiveRouteSubscription(routeKey)) {
			throw new Error(`There is already a subscription to route ${routeKey}.`);
		}

		const subscription = new SocketClientRouteSubscription(this, routeKey, {
			reactiveObjectProvider: this.reactiveObjectProvider,
			...params
		});
		this.reactiveObjectProvider.set(this.data.routeSubscriptions, routeKey, this.reactiveObjectProvider.makeUnreactive(subscription));
		return mergeObjectWithPromise(subscription, subscription.subscribePromise);
	}

	async _unsubscribeFromRoute(routeKey: string): Promise<void> {
		this.reactiveObjectProvider.delete(this.data.routeSubscriptions, routeKey);
		await this._call("unsubscribeFromRoute", routeKey);
	}

	async exportRoute(routeKey: string, data: { format: ExportFormat }): ReturnType<ApiV3<true>["exportLine"]> {
		const result = await this._call("exportRoute", routeKey, data);
		return {
			...result,
			data: this._handleStream(result.data)
		};
	}

	async setBbox(bbox: BboxWithZoom): Promise<void> {
		this.reactiveObjectProvider.set(this.data, "bbox", bbox);
		await this._call("setBbox", bbox);
	}

	async setLanguage(language: SetLanguageRequest): Promise<void> {
		await this._call("setLanguage", language);
	}

	disconnect(): void {
		this.socket.offAny();
		this.socket.disconnect();
	}

	protected _emit<E extends EventName<ClientEvents>>(eventName: E, ...data: ClientEvents[E]): void {
		const fixedData = this._fixEventObject(eventName, data);
		super._emit(eventName, ...fixedData);
	}
}
