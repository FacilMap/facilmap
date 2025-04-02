# Changelog

The websocket on the FacilMap server provides different API versions (implemented as socket.io namespaces such as `/` for version 1, `/v2` for version 2, etc.). When a backwards-incompatible API change is made, it is served under a new API version. For now, the FacilMap server keeps serving all legacy API versions to make sure to not break any existing clients. If you are running a client and it breaks, please [report an issue](https://github.com/FacilMap/facilmap/issues) even if you find a solution to the problem.

Each release of facilmap-client is adapted to a particular API version of the server. When upgrading to a new version of the client, have a look at this page to find out what has changed.

## v5.0.0 (API v3)

_Note: This socket version is still under development and will still change. Do not use it in production yet._

API v3 is a complete overhaul of the API where few things stayed the same. In addition to the Socket API, there is now a REST API, and the two APIs provide exactly the same interface. As a side-effect, many Socket API methods have been renamed and their signatures changed to better fit the structure of a REST API.

To main advantage of the Socket API compared to REST is still that you can get live updates for maps. Before, each socket connection was connected to one specific map (or none), and all the socket methods were executed in the context of this map. To keep the Socket API consistent with the REST API, the socket methods are now context-less, and a map slug (formerly called pad ID) needs to be provided for each of them. This change also makes it possible to subscribe to live changes of multiple maps and unsubscribe again, all within one socket connection.

In the process of the API overhaul, some legacy terminology and source of confusion has been brought up to date (“pad” → “map”, “symbol” → “icon”).

For better support for larger maps, some API methods now return streams of objects rather than returning all data at once. In the REST API, this is implemented by sending the JSON object bit by bit, while in the Socket API, the methods return a stream ID string and the chunks are sent as `streamChunks` events.

### API changes

* “symbol” was renamed to “icon” everywhere. This applies to `Marker.symbol`, `Type.defaultSymbol`, `Type.symbolFixed`, `Type.fields[].controlSymbol` and `Type.fields[].options[].symbol`.
* “pad” was renamed “map” everywhere. This applies to the `padData` and `deletePad` socket events and `getPad`, `findPads`, `createPad`, `editPad`, `deletePad` client/socket methods, and the `Marker.padId`, `Line.padId`, `Type.padId`, `View.padId` and `HistoryEntry.padId` properties.
* “padId” (the unique string that is part of a shareable map link) is now called “mapSlug” throughout the code base. “mapId” now refers to the internal ID of a map, which is a number instead of a string. The map ID is not used in any API methods, but the `mapId` property of types, views, markers and lines is now this number, allowing the object to be associated with a map independently of its configured map slugs.
* The socket client provides the same API methods as the new REST client. This means that a map slug now needs to be specified for all methods (there is no “active” map anymore), in particular `updateMap`, `deleteMap`, `revertHistoryEntry`, `createType`, `updateType`, `deleteType`, `createView`, `updateView`, `deleteView`, `getMarker`, `createMarker`, `updateMarker`, `deleteMarker`, `createLine`, `updateLine`, `deleteLine`, `findOnMap`. However, the [`SocketClientMapSubscription`](./classes.md#socketclientmapsubscription) client class provides convenience methods that are scoped to a specific map slug.
* Some methods now accept more than one parameter. If you are using your own socket.io connection, this means that the last parameter (rather than always the second parameter) will now be considered to be the [acknowledgement callback](https://socket.io/docs/v4/emitting-events/#acknowledgements). If you are using facilmap-client, this change will not have any consequences, as it provides its own acknowledgement callback that resolves its returned promise.
* A few method signatures have been changed:
	* `findPads({ query, start, limit })` was changed to `findMaps(query, { start, limit })`
	* `getPad({ padId })` was changed to `getMap(mapSlug)` and now returns the full map data. It now throws an error when trying to open a non-existent map rather than returning null.
	* `find({ query, loadUrls? })` has been split up into `find(query)` and `findUrl(url)`. Use `parseUrlQuery(query)` from `facilmap-utils` to check whether a search query is a URL (if it returns a string, it is).
	* `findOnMap({ query })` has been changed to `findOnMap(mapSlug, query)`.
	* `exportRoute({ routeId, format })` has been changed into `exportRoute(routeKey, { format })`.
* A few methods have been renamed:
	* `add*` has been renamed to `create*` (`addMarker`, `addLine`, `addType`, `addView`)
	* `edit*` has been renamed to `update*` (`editPad`, `editMarker`, `editLine`, `editType`, `editView`)
* `getLineTemplate` has been removed. Use `getLineTemplate(type)` from `facilmap-utils` instead.
* In the `linePoints` socket event, `id` was renamed to `lineId`.
* `setRoute` and `lineToRoute` have been united into `subscribeToRoute`, which accepts both types of objects. `clearRoute({ routeId })` has been changed into `unsubscribeFromRoute(routeKey)`. Specifying a route key is mandatory now, although you can just use an empty string.
* `setPadId` has been removed. To subscribe to map live updates, use `subscribeToMap`. As a replacement for `PadNotFoundError`, an error with a `status: 404` property is thrown if the map is not found.
* `listenToHistory()` has been merged into `subscribeToMap(mapSlug, { history: true })` and does not return any history entries anymore. To retrieve those history entries, use `getHistory(mapSlug, paging)`. The current limit of maximum 50 history entries that are retained per map may be increased or removed in the future without further notice (hence the paging). `stopListeningToHistory()` has been merged into `subscribeToMap(mapSlug, { history: false })`.
* `createPad()` was renamed to `createMapAndSubscribe()` and emits events rather than returning them. The new `createMap()` method creates the map without subscribing to it.
* `updateBbox` has been renamed to `setBbox`. Rather than returing an object of map events, it now emits those events and returns an empty promise.

### Client changes

Rather than a single client implementation, there is now a `SocketClient` and a `RestClient`, both providing mostly the same interface.

When constructing the `SocketClient`, you cannot provide a map ID anymore, but rather need to subscribe to one or more maps manually using `subscribeToMap()`.

All of the properties of the client instance have changed:
* `mapId` was removed, since there can now be multiple map subscriptions. Those are stored in the `client.mapSubscriptions` property.
* `readonly` and `writable` were removed. They can now be inferred from the `writable` property of the `mapData` event. When using `ClientStorage`, it is available as `storage.maps[mapSlug].mapData.writable`.
* `deleted` was removed. Instead, the map subscription state is available as `client.mapSubscriptions[mapSlug].state.type`. If it is `MapSubscriptionStateType.DELETED` (`"deleted"`), the map has been deleted.
* `mapData`, `markers`, `lines`, `views`, `types`, `history` are not available by default anymore. To use them, use `SocketClientStorage` and find them under `storage.maps[mapSlug]`.
* `route` and `routes` are not available by default anymore. To use them use `SocketClientStorage` and find them under `storage.routes[routeKey]`. Every route now needs a route key (formerly called route ID), there is no default route anymore.
* `serverError`, `disconnected` are not available anymore. The connection state is available as `client.state.type` and can be `ClientStateType.FATAL_ERROR` (`"fatal_error"`) or `ClientStateType.RECONNECTING` (`"reconnecting"`) for example.
* `loading` was renamed to `runningOperations`.


## v4.0.0 (API v2)

* Before, creating a map with an empty name resulted in `padData.name` set to `"Unnamed map"`. Now, an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.
* Before, creating a marker with an empty name resulted in `marker.name` set to `"Untitled marker"`. Now an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.
* Before, creating a line with an empty name resulted in `line.name` set to `"Untitled line"`. Now an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.