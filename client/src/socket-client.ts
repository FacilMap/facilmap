import { io, type ManagerOptions, type Socket as SocketIO, type SocketOptions } from "socket.io-client";
import {
	type Bbox, type BboxWithZoom, type CRU, type EventHandler, type EventName, type FindMapsResult, type ID,
	type Line, type SocketEvents, type Marker, type MapData, type MapSlug, type PagedResults, type RouteInfo,
	type RouteRequest, type SearchResult, type SocketVersion, type TrackPoint, type Type, type View,
	type SocketClientToServerEvents, type SocketServerToClientEvents, type SetLanguageRequest, type PagingInput,
	type AllMapObjectsPick, type StreamedResults, type BboxWithExcept, type AllMapObjectsItem, type SocketApi,
	type StreamId, type FindOnMapResult, type HistoryEntry, type StreamToStreamId, type RouteParameters,
	type LineToRouteRequest, type LineWithTrackPoints, type DeepReadonly, type SubscribeToMapOptions,
	ApiVersion, type Api, type AllMapObjects, type LineTemplate, type AnyMapSlug, type Stripped,
	getMainAdminLink, type MapPermissions, type ExportResult,
	type AnyMapSlugWithoutIdentity
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

const SOCKET_EVENTS = ["connect", "disconnect", "connect_error"] as const satisfies Array<EventName<ClientEvents>>;
const MANAGER_EVENTS = ["error", "reconnect", "reconnect_attempt", "reconnect_error", "reconnect_failed"] as const satisfies Array<EventName<ClientEvents>>;

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
	handleChunk: (chunk: any) => void;
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

		for (const event of SOCKET_EVENTS) {
			this.socket.on(event, (...data: any) => { this._emit(event, ...data); });
		}

		for (const event of MANAGER_EVENTS) {
			(this.socket.io as any).on(event, (...data: any) => { this._emit(event, ...data); });
		}

		this.socket.on("events", (events) => {
			for (const event of events) {
				// @ts-ignore
				this._emit(...event);
			}
		});

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
				handleChunk: (chunk) => {
					// Uint8Arrays sent over Socket.IO arrive as ArrayBuffers
					writer.write(chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : chunk).catch(() => undefined);
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

	protected _handleExportResult(result: Omit<ExportResult, "data"> & { data: StreamId<Uint8Array> }): ExportResult {
		return {
			...result,
			data: this._handleStream(result.data)
		};
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
						resolve(data);
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

			streamChunk: (streamId, chunk) => {
				this._getStream(streamId).handleChunk(chunk);
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

	async getMap(mapSlug: AnyMapSlug): Promise<Stripped<MapData>> {
		return await this._call("getMap", mapSlug);
	}

	async createMap<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<AsyncIterable<AllMapObjectsItem<Pick>, void, undefined>> {
		const result = await this._call("createMap", data, options);
		return mapNestedIterable(this._handleIterable(result), (obj) => ({ ...obj, data: this._handleIterable<any>(obj.data) } as AllMapObjectsItem<Pick>));
	}

	async createMapUnstreamed<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<AllMapObjects<Pick>> {
		return await unstreamMapObjects(await this.createMap(data, options));
	}

	async updateMap(mapSlug: AnyMapSlug, data: MapData<CRU.UPDATE>): Promise<Stripped<MapData>> {
		return await this._call("updateMap", mapSlug, data);
	}

	async deleteMap(mapSlug: AnyMapSlug): Promise<void> {
		await this._call("deleteMap", mapSlug);
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick>(mapSlug: AnyMapSlug, options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<AsyncIterable<AllMapObjectsItem<Pick>, void, undefined>> {
		const result = await this._call("getAllMapObjects", mapSlug, options);
		return mapNestedIterable(this._handleIterable(result), (obj) => ({ ...obj, data: this._handleIterable<any>(obj.data) } as AllMapObjectsItem<Pick>));
	}

	async getAllMapObjectsUnstreamed<Pick extends AllMapObjectsPick>(mapSlug: AnyMapSlug, options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<AllMapObjects<Pick>> {
		return await unstreamMapObjects(await this.getAllMapObjects(mapSlug, options));
	}

	async findOnMap(mapSlug: AnyMapSlug, query: string): Promise<Array<Stripped<FindOnMapResult>>> {
		return await this._call("findOnMap", mapSlug, query);
	}

	async getMapToken(mapSlug: AnyMapSlug, options: { permissions: MapPermissions; noPassword?: boolean }): Promise<{ token: string }> {
		return await this._call("getMapToken", mapSlug, options);
	}

	async exportMapAsGpx(mapSlug: AnyMapSlug, options?: { rte?: boolean; filter?: string }): Promise<ExportResult> {
		return this._handleExportResult(await this._call("exportMapAsGpx", mapSlug, options));
	}

	async exportMapAsGpxZip(mapSlug: AnyMapSlug, options?: { rte?: boolean; filter?: string }): Promise<ExportResult> {
		return this._handleExportResult(await this._call("exportMapAsGpxZip", mapSlug, options));
	}

	async exportMapAsGeoJson(mapSlug: AnyMapSlug, options?: { filter?: string }): Promise<ExportResult> {
		return this._handleExportResult(await this._call("exportMapAsGeoJson", mapSlug, options));
	}

	async exportMapAsTable(mapSlug: AnyMapSlug, options: { typeId: ID; filter?: string; hide?: string[] }): Promise<ExportResult> {
		return this._handleExportResult(await this._call("exportMapAsTable", mapSlug, options));
	}

	async exportMapAsCsv(mapSlug: AnyMapSlug, options: { typeId: ID; filter?: string; hide?: string[] }): Promise<ExportResult> {
		return this._handleExportResult(await this._call("exportMapAsCsv", mapSlug, options));
	}

	async getHistory(mapSlug: AnyMapSlug, data?: PagingInput): Promise<PagedResults<Stripped<HistoryEntry>>> {
		return await this._call("getHistory", mapSlug, data);
	}

	async revertHistoryEntry(mapSlug: AnyMapSlug, historyEntryId: ID): Promise<void> {
		await this._call("revertHistoryEntry", mapSlug, historyEntryId);
	}

	async getMapMarkers(mapSlug: AnyMapSlug, options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Stripped<Marker>>> {
		const result = await this._call("getMapMarkers", mapSlug, options);
		return {
			results: this._handleIterable(result.results)
		};
	}

	async getMarker(mapSlug: AnyMapSlug, markerId: ID): Promise<Stripped<Marker>> {
		return await this._call("getMarker", mapSlug, markerId);
	}

	async createMarker(mapSlug: AnyMapSlug, data: Marker<CRU.CREATE>): Promise<Stripped<Marker>> {
		return await this._call("createMarker", mapSlug, data);
	}

	async updateMarker(mapSlug: AnyMapSlug, markerId: ID, data: Marker<CRU.UPDATE>): Promise<Stripped<Marker>> {
		return await this._call("updateMarker", mapSlug, markerId, data);
	}

	async deleteMarker(mapSlug: AnyMapSlug, markerId: ID): Promise<void> {
		await this._call("deleteMarker", mapSlug, markerId);
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: AnyMapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? Stripped<LineWithTrackPoints> : Stripped<Line>>> {
		const result = await this._call("getMapLines", mapSlug, options);
		return {
			results: this._handleIterable(result.results) as AsyncIterable<IncludeTrackPoints extends true ? Stripped<LineWithTrackPoints> : Stripped<Line>, void, undefined>
		};
	}

	async getLine(mapSlug: AnyMapSlug, lineId: ID): Promise<Stripped<Line>> {
		return await this._call("getLine", mapSlug, lineId);
	}

	async getLinePoints(mapSlug: AnyMapSlug, lineId: ID, options?: { bbox?: BboxWithZoom & { except?: Bbox } }): Promise<StreamedResults<TrackPoint>> {
		const result = await this._call("getLinePoints", mapSlug, lineId, options);
		return {
			results: this._handleIterable(result.results)
		};
	}

	async createLine(mapSlug: AnyMapSlug, data: DeepReadonly<Line<CRU.CREATE>>): Promise<Stripped<Line>> {
		return await this._call("createLine", mapSlug, data);
	}

	async updateLine(mapSlug: AnyMapSlug, lineId: ID, data: DeepReadonly<Line<CRU.UPDATE>>): Promise<Stripped<Line>> {
		return await this._call("updateLine", mapSlug, lineId, data);
	}

	async deleteLine(mapSlug: AnyMapSlug, lineId: ID): Promise<void> {
		await this._call("deleteLine", mapSlug, lineId);
	}

	async exportLineAsGpx(mapSlug: AnyMapSlug, lineId: ID, options?: { rte?: boolean }): Promise<ExportResult> {
		return this._handleExportResult(await this._call("exportLineAsGpx", mapSlug, lineId, options));
	}

	async exportLineAsGeoJson(mapSlug: AnyMapSlug, lineId: ID): Promise<ExportResult> {
		return this._handleExportResult(await this._call("exportLineAsGeoJson", mapSlug, lineId));
	}

	async getLineTemplate(mapSlug: AnyMapSlug, options: { typeId: ID }): Promise<LineTemplate> {
		return await this._call("getLineTemplate", mapSlug, options);
	}

	async getMapTypes(mapSlug: AnyMapSlug): Promise<StreamedResults<Stripped<Type>>> {
		const result = await this._call("getMapTypes", mapSlug);
		return {
			results: this._handleIterable(result.results)
		};
	}

	async getType(mapSlug: AnyMapSlug, typeId: ID): Promise<Stripped<Type>> {
		return await this._call("getType", mapSlug, typeId);
	}

	async createType(mapSlug: AnyMapSlug, data: Type<CRU.CREATE>): Promise<Stripped<Type>> {
		return await this._call("createType", mapSlug, data);
	}

	async updateType(mapSlug: AnyMapSlug, typeId: ID, data: Type<CRU.UPDATE>): Promise<Stripped<Type>> {
		return await this._call("updateType", mapSlug, typeId, data);
	}

	async deleteType(mapSlug: AnyMapSlug, typeId: ID): Promise<void> {
		await this._call("deleteType", mapSlug, typeId);
	}

	async getMapViews(mapSlug: AnyMapSlug): Promise<StreamedResults<Stripped<View>>> {
		const result = await this._call("getMapViews", mapSlug);
		return {
			results: this._handleIterable(result.results)
		};
	}

	async getView(mapSlug: AnyMapSlug, viewId: ID): Promise<Stripped<View>> {
		return await this._call("getView", mapSlug, viewId);
	}

	async createView(mapSlug: AnyMapSlug, data: View<CRU.CREATE>): Promise<Stripped<View>> {
		return await this._call("createView", mapSlug, data);
	}

	async updateView(mapSlug: AnyMapSlug, viewId: ID, data: View<CRU.UPDATE>): Promise<Stripped<View>> {
		return await this._call("updateView", mapSlug, viewId, data);
	}

	async deleteView(mapSlug: AnyMapSlug, viewId: ID): Promise<void> {
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

	async _subscribeToMap(mapSlug: AnyMapSlugWithoutIdentity, options?: DeepReadonly<SubscribeToMapOptions>): Promise<void> {
		await this._call("subscribeToMap", mapSlug, options);
	}

	subscribeToMap(anyMapSlug: AnyMapSlugWithoutIdentity, options?: SubscribeToMapOptions): SocketClientMapSubscription & BasicPromise<SocketClientMapSubscription> {
		const mapSlug = typeof anyMapSlug === "string" ? anyMapSlug : anyMapSlug.mapSlug;
		if (this.hasActiveMapSubscription(mapSlug)) {
			throw new Error(`There is already a subscription to map ${mapSlug}.`);
		}

		const subscription = new SocketClientMapSubscription(this, anyMapSlug, {
			reactiveObjectProvider: this.reactiveObjectProvider,
			...options
		});
		this.reactiveObjectProvider.set(this.data.mapSubscriptions, mapSlug, this.reactiveObjectProvider.makeUnreactive(subscription));
		return mergeObjectWithPromise(subscription, subscription.subscribePromise);
	}

	async _createMapAndSubscribe(data: DeepReadonly<MapData<CRU.CREATE>>, options?: DeepReadonly<SubscribeToMapOptions>): Promise<void> {
		await this._call("createMapAndSubscribe", data, options);
	}

	createMapAndSubscribe(data: MapData<CRU.CREATE>, options?: SubscribeToMapOptions): SocketClientMapSubscription & BasicPromise<SocketClientMapSubscription> {
		const mainAdminLink = getMainAdminLink(data.links);
		if (this.hasActiveMapSubscription(mainAdminLink.slug)) {
			throw new Error(`There is already a subscription to map ${mainAdminLink.slug}.`);
		}

		const subscription = new SocketClientCreateMapSubscription(this, data, {
			reactiveObjectProvider: this.reactiveObjectProvider,
			...options
		});
		this.reactiveObjectProvider.set(this.data.mapSubscriptions, mainAdminLink.slug, this.reactiveObjectProvider.makeUnreactive(subscription));
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

	async exportRouteAsGpx(routeKey: string, data?: { rte?: boolean }): Promise<ExportResult> {
		return this._handleExportResult(await this._call("exportRouteAsGpx", routeKey, data));
	}

	async exportRouteAsGeoJson(routeKey: string): Promise<ExportResult> {
		return this._handleExportResult(await this._call("exportRouteAsGeoJson", routeKey));
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

}
