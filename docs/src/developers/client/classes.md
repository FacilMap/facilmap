# Classes

## `RestClient`

```typescript
new RestClient(
	server: string,
	options?: {
		fetch?: typeof fetch,
		query?: { lang?: string;  units?: "metric" | "us_customary" }
	}
)
```

Constructs a new client that allows using the REST API in a typed manner. `server` is the URL of the server (such as `https://facilmap.org/`). You can optionally provide a custom `fetch` function that the client will use.

### Methods

#### API methods

The client instance provides the methods documented under [API methods](./methods.md).

## `SocketClient`

```typescript
new SocketClient(
	server: string,
	options?: Partial<ManagerOptions & SocketOptions & {
		reactiveObjectProvider?: ReactiveObjectProvider
	}>
)
```

Constructs and connects a new client to the Socket API. `server` is the URL of the server (such as `https://facilmap.org/`). The `options` parameter supports all the [Socket.IO client options](https://socket.io/docs/v4/client-options/) and a custom `reactiveObjectProvider` for [reactivity](./advanced.md#reactivity).

### Properties

#### `reactiveObjectProvider`

Type: `ReactiveObjectProvider`

The reactive object provider for [reactivity](./advanced.md#reactivity).

#### `connectPromise`

Type: `Promise<this>`

A promise that is resolved (with the client instance) when the state changes to “connected” for the first time and is rejected when the state changes to “fatal error”.

#### `state`

Type: `{ type: ClientStateType; error?: Error }`

`type` can be:
* `ClientStateType.INITIAL`: The client has been constructed. Unless you set `autoConnect: false` in the Socket.IO options, it is currently connecting.
* `ClientStateType.CONNECTED`: The client is connected.
* `ClientStateType.RECONNECTING`: The connection was lost and the client is trying to reconnect.
* `ClientStateType.FATAL_ERROR`: The connection has failed and no further tries are being made. The error is stored in the `error` property.

#### `server`

Type: `string`

The server URL provided to the constructor.

#### `bbox`

Type: `{ top: number; bottom: number; left: number; right: number; zoom: number } | undefined`

The last bbox set through [`setBbox()`](./methods.md#setbbox)

#### `mapSubscriptions`

Type: `Record<string, SocketClientMapSubscription>`

The active [map subscriptions](#socketclientmapsubscription) by map slug. The map slug is automatically updated if it is renamed (by any user).

#### `routeSubscriptions`

Type: `Record<string, SocketClientRouteSubscription>`

The active [route subscriptions](#socketclientroutesubscription) by route key.

#### `runningOperations`

Type: `number`

The number of currently pending requests to the API. If it is greater than 0, you can show a loading spinner.

### Methods

#### API methods

The client instance provides the methods documented under [API methods](./methods.md).

Note that the subscriptions returned by [`subscribeToMap()`](#subscribetomap) and [`subscribeToRoute()`](#subscribetoroute) provide API methods scoped to the subscribed map slug / route key and might be more convenient to use where applicable.

#### `subscribeToMap()`

Signature: `subscribeToMap(mapSlug: string, options?: SubscribeToMapOptions): SocketClientMapSubscription`

Like [`subscribeToMap`](./methods.md#subscribetomap), but returns a [`SocketClientMapSubscription`](#socketclientmapsubscription) object to further manage the subscription. Throws an error if the map slug is already subscribed.

For your convenience, the `SocketClientMapSubscription` is returned merged with its [`subscribePromise`](#subscribepromise). This means that you can either call `subscribeToMap()` synchronously, which returns the subscription immediately so that you can observe the data as it comes in and the state as it eventually transitions to `SUBSCRIBED` or `FATAL_ERROR`, or you can call `await subscribeToMap()`, which returns a promise that is resolved with the subscription only once all the map objects have been received and the subscription has transitioned to `SUBSCRIBED`.

#### `createMapAndSubscribe()`

Signature: `createMapAndSubscribe(data: MapData<CRU.CREATE>, options?: SubscribeToMapOptions): SocketClientMapSubscription`

Like [`createMapAndSubscribe`](./methods.md#createmap), but returns a [`SocketClientMapSubscription`](#socketclientmapsubscription) object merged with its `subscribePromise` to further manage the subscription.

#### `subscribeToRoute()`

Signature: `subscribeToRoute(routeKey: string, params: RouteParameters | LineToRouteRequest): SocketClientRouteSubscription`

Like [`subscribeToRoute`](./methods.md#subscribetoroute), but returns a [`SocketClientRouteSubscription`](#socketclientroutesubscription) to further manage the subscription. Throws an error if the route key is already subscribed.

For your convenience, the `SocketClientRouteSubscription` is returned merged with its [`subscribePromise`](#subscribepromise-1). This means that you can either call `subscribeToRoute()` synchronously, which returns the subscription immediately so that you can observe the data as it comes in and the state as it eventually transitions to `SUBSCRIBED` or `FATAL_ERROR`, or you can call `await subscribeToRoute()`, which returns a promise that is resolved with the subscription only once the route has been received and the subscription has transitioned to `SUBSCRIBED`.

#### `disconnect()`

Signature: `disconnect(): void`

Disconnects the client.

#### `on()`

Signature: `on<E extends keyof ClientEvents>(eventName: E, fn: (...args: ClientEvents[E]) => void)`

Registers an [event](./events.md) handler.

#### `once()`

Signature: `once<E extends keyof ClientEvents>(eventName: E, fn: (...args: ClientEvents[E]) => void)`

Registers an [event](./events.md) handler that is only called once.

#### `removeListener()`

Signature: `removeListener<E extends keyof ClientEvents>(eventName: E, fn: (...args: ClientEvents[E]) => void)`

Unregisters an event handler.

### Events

#### API events

Any [API events](./events.md) will be emitted by the client.

#### Socket.IO events

The events `connect`, `disconnect`, `connect_error`, `error`, `reconnect`, `reconnect_attempt`, `reconnect_error`, and `reconnect_failed` come from Socket.IO and are [documented there](https://socket.io/docs/v4/client-api/#events).

#### `operationStart`, `operationEnd`

This event is fired every time some request is sent to the server and when the response has arrived. It can be used to
display a loading indicator to the user. Note that multiple things can be loading at the same time. The current number of running operations is also available as the [runningOperations](#runningoperations) property.

#### `emit`

Parameters: `eventName: string, { args: any[]; result: Promise<any> }`

Emitted whenever any request is sent to the server. In the context of this event, “emit” and “event” refers to Socket API methods being called by emitting a Socket.IO event using [`socket.emit()`](https://socket.io/docs/v4/client-api/#socketemiteventname-args). The `eventName` is the name of the Socket API method, `args` is the array of arguments, and `result` is the promise that is eventually resolved with the result.

You can use this hook into the communication between the client and the server and handle the request or result in an additional way.

#### `fatalError`

Parameters: `error: Error`

Emitted when the connection to the socket cannot be established and no further attempts will be made. The fatal error will be also available in the [`state`](#state).

## `SocketClientMapSubscription`

Allows managing a map subscription made through [`subscribeToMap()`](#subscribetomap).

### Properties

#### `client`

Type: `SocketClient`

The client instance that created this subscription.

#### `subscribePromise`

Type: `Promise<this>`

A promise that is resolved (with the subscription itself) when all map objects have been received or that is rejected when there is an error subscribing to the map.

#### `reactiveObjectProvider`

Type: `ReactiveObjectProvider`

The reactive object provider for [reactivity](./advanced.md#reactivity).

#### `state`

Type: `{ type: SubscriptionStateType | MapSubscriptionStateType; error?: Error }`

`type` can be one of the following:
* `SubscriptionStateType.SUBSCRIBING`: The subscription is currently in progress, map objects are arriving. This is the case after subscribing, after updating the subscription, and after a lost socket connection is restored.
* `SubscriptionStateType.SUBSCRIBED`: The subscription is active, all map objects have arrived.
* `SubscriptionStateType.UNSUBSCRIBED`: The subscription was canceled using [`unsubscribe()`](#unsubscribe).
* `SubscriptionStateType.DISCONNECTED`: The socket connection was lost, reconnection is in progress. Once reconnectd, the state will change to `SUBSCRIBING`.
* `SubscriptionStateType.FATAL_ERROR`: Subscribing to the map failed. The error is saved in the `error` property.
* `MapSubscriptionStateType.DELETED`: The subscribed map was deleted.

#### `mapSlug`

Type: `string`

The map slug of this subscription. This is automatically updated if the map slug is renamed (by any user).

#### `options`

Type: `SubscribeToMapOptions`

The options passed to [`subscribeToMap()`](#subscribetomap). Can be updated by calling [`updateSubscription`](#updatesubscription).

### Methods

#### API methods

The map subscription instance provides all of the methods documented under [API methods](./methods.md) that accept a map slug as the first argument, but with that argument removed (the map slug of the subscription is automatically applied).

#### `updateSubscription()`

Signature: `updateSubscription(options: SubscribeToMapOptions): Promise<void>`

Change the subscription options (for example to subscribe to additional data types). When called, the [`state`](#state-1) type is _synchronously_ changed to `SUBSCRIBING`. Once all the additionally subscribed map objects (if any) have been received, the state changes back to `SUBSCRIBED` and the returned promise is resolved.

#### `unsubscribe()`

Signature: `unsubscribe(): Promise<void>`

Unsubscribes from the map. Causes the [`state`](#state-1) type to change to `UNSUBSCRIBED` synchronously and the subscription to be removed from the [`mapSubscriptions`](#mapsubscriptions) object of the client.


## `SocketClientRouteSubscription`

Allows managing a route subscription made through [`subscribeToRoute()`](#subscribetoroute).

### `client`

Type: `SocketClient`

The client instance that created this subscription.

### `subscribePromise`

Type: `Promise<this>`

A promise that is resolved (with the subscription itself) when the route data has been received or that is rejected when there is an error subscribing to the route.

### `reactiveObjectProvider`

Type: `ReactiveObjectProvider`

The reactive object provider for [reactivity](./advanced.md#reactivity).

### `state`

Type: `{ type: SubscriptionStateType; error?: Error }`

`type` can be one of the following:
* `SubscriptionStateType.SUBSCRIBING`: The subscription is currently in progress, the route data is arriving. This is the case after subscribing, after updating the subscription, and after a lost socket connection is restored.
* `SubscriptionStateType.SUBSCRIBED`: The subscription is active, all route data has arrived.
* `SubscriptionStateType.UNSUBSCRIBED`: The subscription was canceled using [`unsubscribe()`](#unsubscribe).
* `SubscriptionStateType.DISCONNECTED`: The socket connection was lost, reconnection is in progress. Once reconnectd, the state will change to `SUBSCRIBING`.
* `SubscriptionStateType.FATAL_ERROR`: Subscribing to the route failed. The error is saved in the `error` property.

### `routeKey`

Type: `string`

The route key of this subscription.

### `options`

Type: `SubscribeToRouteOptions`

The options passed to [`subscribeToRoute()`](#subscribetoroute). Can be updated by calling [`updateSubscription`](#updatesubscription-1).

### API methods

The map subscription instance provides all of the methods documented under [API methods](./methods.md) that accept a route key as the first argument, but with that argument removed (the route key of the subscription is automatically applied).

### `updateSubscription()`

Signature: `updateSubscription(options: SubscribeToRouteOptions): Promise<void>`

Change the subscription options (for example to change the route points or mode). When called, the [`state`](#state-2) type is _synchronously_ changed to `SUBSCRIBING`. Once all the new route data has been received, the state changes back to `SUBSCRIBED` and the returned promise is resolved.

### `unsubscribe()`

Signature: `unsubscribe(): Promise<void>`

Unsubscribes from the route. Causes the [`state`](#state-2) type to change to `UNSUBSCRIBED` synchronously and the subscription to be removed from the [`routeSubscriptions`](#routesubscriptions) object of the client.


## `SocketClientStorage`

```typescript
new SocketClientStorage(
	client: SocketClient,
	options?: {
		reactiveObjectProvider?: ReactiveObjectProvider;
	}
)
```

Registers event listeners on the given socket client that will automatically handle all received map objects and route data and stores them to keep an up-to-date copy of the current state of the maps/routes in its properties.

Call this _before_ subscribing to any maps/routes, otherwise it will miss the data.

### `reactiveObjectProvider`

Type: `ReactiveObjectProvider`

The reactive object provider for [reactivity](./advanced.md#reactivity).

### `client`

Type: `SocketClient`

The client instance that this storage was created for.

### `maps`

```typescript
Record<string, {
	mapData: DeepReadonly<MapData> | undefined;
	markers: Record<ID, DeepReadonly<Marker>>;
	lines: Record<ID, DeepReadonly<LineWithTrackPoints>>;
	views: Record<ID, DeepReadonly<View>>;
	types: Record<ID, DeepReadonly<Type>>;
	history: Record<ID, DeepReadonly<HistoryEntry>>;
}>
```

All the map objects (by map slug) that have been received from the server for each map subscription (see [types](./types.md) for details on the object types). As indicated by the `DeepReadonly` typing, properties of individual map objects are never changed – the whole object is always replaced.

### `routes`

```typescript
Record<string, DeepReadonly<Route & { trackPoints: TrackPoints }>>
```

All the route data (by route key) that has been received from the server for each route subscription  (see [types](./types.md) for details on the data types). As indicated by the `DeepReadonly` typing, properties of individual routes are never changed – the whole route object is always replaced.

### `storeMapData()`

Signature: `storeMapData(mapSlug: string, mapData: MapData): void`

Manually add map data to the store as if it had been received from the server.

### `storeMarker()`

Signature: `storeMarker(mapSlug: string, marker: Marker): void`

Manually add a marker to the store as if it had been received from the server.

### `clearMarker()`

Signature: `clearMarker(mapSlug: string, markerId: number): void`

Manually remove a marker from the store as if it had been deleted on the server.

### `storeLine()`

Signature: `storeLine(mapSlug: string, line: Line): void`

Manually add a line to the store as if it had been received from the server.

### `storeLinePoints()`

Signature: `storeLinePoints(mapSlug: string, linePoints: { lineId: number; trackPoints: TrackPoint[] }, reset: boolean): void`

Manually add track points for a line to the store as if they had been received from the server.

This will do nothing if the corresponding line is not in the store yet.

If `reset` is `true`, the track points will replace the current track points (this is usually done when the route points of a line have changed). Otherwise, the track points will be merged with the current track points (this is usually done when the bbox changes and a new section of the line is received).

### `clearLine()`

Signature: `clearLine(mapSlug: string, lineId: number): void`

Manually remove a line from the store as if it had been deleted on the server.

### `storeType()`

Signature: `storeType(mapSlug: string, type: Type): void`

Manually add a type to the store as if it had been received from the server.

### `clearType()`

Signature: `clearType(mapSlug: string, typeId: number): void`

Manually remove a type from the store as if it had been deleted on the server.

### `storeView()`

Signature: `storeView(mapSlug: string, view: View): void`

Manually add a view to the store as if it had been received from the server.

### `clearView()`

Signature: `clearView(mapSlug: string, viewId: number): void`

Manually remove a view from the store as if it had been deleted on the server.

### `storeHistoryEntry()`

Signature: `storeHistoryEntry(mapSlug: string, historyEntry: HistoryEntry): void`

Manually add a history entry to the store as if it had been received from the server.

### `clearHistoryEntry()`

Signature: `clearHistoryEntry(mapSlug: string, historyEntryId: number): void`

Manually remove a history entry from the store as if it had been deleted on the server.

### `clearHistory()`

Signature: `clearHistory(mapSlug: string): void`

Remove all the history entries of the given map from the store.

### `storeRoute()`

Signature: `storeRoute(routeKey: string, route: Route): void`

Manually add a route to the store as if it had been received from the server.

### `storeRoutePoints()`

Signature: `storeRoutePoints(routeKey: string, routePoints: RoutePoints, reset: boolean): void`

Manually add track points for a route to the store as if they had been received from the server.

This will do nothing if the corresponding route is not in the store yet.

If `reset` is `true`, the track points will replace the current track points (this is usually done when the route points have changed). Otherwise, the track points will be merged with the current track points (this is usually done when the bbox changes and a new section of the route is received).