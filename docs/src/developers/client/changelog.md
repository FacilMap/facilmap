# Changelog

The websocket on the FacilMap server provides different API versions (implemented as socket.io namespaces such as `/` for version 1, `/v2` for version 2, etc.). When a backwards-incompatible API change is made, it is served under a new API version. For now, the FacilMap server keeps serving all legacy API versions to make sure to not break any existing clients. If you are running a client and it breaks, please [report an issue](https://github.com/FacilMap/facilmap/issues) even if you find a solution to the problem.

Each release of facilmap-client is adapted to a particular API version of the server. When upgrading to a new version of the client, have a look at this page to find out what has changed.

## v5.0.0 (API v3)

_Note: This socket version is still under development and will still change. Do not use it in production yet._

API v3 is a complete overhaul of the API where few things stayed the same. In addition to the Socket API, there is now a REST API, and the two APIs provide exactly the same interface. This means that many of the Socker API methods have been renamed and their signatures changed to better fit the structure of a REST API.

To main advantage of the Socket API compared to REST is still that you can get live updates for maps. Before, each socket connection was connected to one specific map (or none), and all the socket methods were executed in the context of this map. To keep the Socket API consistent with the REST API, the socket methods are now context-less, and a map slug (formerly called pad ID) needs to be provided for each of them. This change also makes it possible to subscribe to live changes of multiple maps and unsubscribe again, all within one socket connection.

In the process of the API overhaul, some legacy terminology and source of confusion has been brought up to date (“pad” → “map”, “symbol” → “icon”).

For better support for larger maps, some API methods now return streams of objects rather than returning all data at once. In the REST API, this is implemented by sending the JSON object bit by bit, while in the Socket API, the methods return a stream ID string and the chunks are sent as `streamChunks` events.

The specific changes are:

* “symbol” was renamed to “icon” everywhere. This applies to `Marker.symbol`, `Type.defaultSymbol`, `Type.symbolFixed`, `Type.fields[].controlSymbol` and `Type.fields[].options[].symbol`.
* “pad” was renamed “map” everywhere. This applies to the `padData` and `deletePad` socket events and `getPad`, `findPads`, `createPad`, `editPad`, `deletePad` client/socket methods, and the `Marker.padId`, `Line.padId`, `Type.padId`, `View.padId` and `HistoryEntry.padId` properties.
* “padId” (the unique string that is part of a shareable map link) is now called “mapSlug” throughout the code base. “mapId” now refers to the internal ID of a map.
* The socket client provides the same API methods as the new REST client. This means that a map slug now needs to be specified for all methods (there is no “active” map anymore), in particular `updateMap`, `deleteMap`, `revertHistoryEntry`, `getMarker`, `createMarker`, `updateMarker`, `deleteMarker`, `createLine`, `updateLine`, `deleteLine`
* Some methods now accept more than one parameter. If you are using your own socket.io connection, this means that the last parameter (rather than the second parameter) will now be considered to be the [acknowledgement callback](https://socket.io/docs/v3/emitting-events/#acknowledgements). If you are using facilmap-client, this change will not have any consequences, as it provides its own acknowledgement callback that resolves its returned promise.
* A few method signatures have been changed:
	* `findPads({ query, start, limit })` was changed to `findMaps(query, { start, limit })`
	* `getPad({ padId })` was changed to `getMap(mapSlug)` and now returns the full map data
	* `createPad(padData)` was changed to `createMap(padData, { pick?, bbox? })`. It now returns a `{ results: stream }` of map object tuples rather than an object of map events.
	* `find({ query, loadUrls? })` has been split up into `find(query)` and `findUrl(url)`. Use `parseUrlQuery(query)` from `facilmap-utils` to check whether a search query is a URL (if it returns a string, it is).
	* `findOnMap({ query })` has been changed to `findOnMap(query)`.
	* `exportRoute({ routeId, format })` has been changed into `exportRoute(routeId, { format })`.
* A few methods have been renamed:
	* `add*` has been renamed to `create*` (`addMarker`, `addLine`, `addType`, `addView`)
	* `edit*` has been renamed to `update*` (`editPad`, `editMarker`, `editLine`, `editType`, `editView`)
* `getLineTemplate` has been removed. Use `getLineTemplate(type)` from `facilmap-utils` instead.
* In the `linePoints` socket event, `id` was renamed to `lineId`.
* `setRoute` and `lineToRoute` have been united into `subscribeToRoute`, which accepts both types of objects. `clearRoute({ routeId })` has been changed into `unsubscribeFromRoute(routeId)`.
* `setPadId` has been removed. To subscribe to map live updates, use `subscribeToMap`. As a replacement for `PadNotFoundError`, an error with a `status: 404` property is thrown if the map is not found.
* `listenToHistory()` has been merged into `subscribeToMapHistory(mapSlug, { history: true })` and does not return any history entries anymore. To retrieve those history entries, use `getHistory(mapSlug, paging)`. The current limit of maximum 50 history entries that are retained per map may be increased or removed in the future without further notice (hence the paging). `stopListeningToHistory()` has been changed into `unsubscribeFromMapHistory(mapSlug)`.
* `createMap()` does not automatically subscribe to the map anymore. It now returns a stream of map objects rather than an object of map events.
* `updateBbox` has been renamed to `setBbox` and now returns a stream of map objects rather than an object of map events.


## v4.0.0 (API v2)

* Before, creating a map with an empty name resulted in `padData.name` set to `"Unnamed map"`. Now, an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.
* Before, creating a marker with an empty name resulted in `marker.name` set to `"Untitled marker"`. Now an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.
* Before, creating a line with an empty name resulted in `line.name` set to `"Untitled line"`. Now an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.