# Methods

## `findMaps()`

Client: `findMaps(query, { start?, limit? })`\
Socket: `emit("findMaps", query, { start?, limit? }, callback)`\
REST: `GET /map?query=<query>&start=<start?>&limit=<limit?>`

Finds collaborative maps by a search term. Only finds maps that have been made public by setting [`searchEngines`](./types.md#mapdata) to `true`.

Parameters:
* `query` (string): The search term
* `start`, `limit` (number): See [paging](./types.md#paging)

Result: `PagedResults<Pick<MapData, "id" | "readId" | "name" | "description">>` (see [PagedResults](./types.md#pagedresults), [MapData](./types.md#mapdata))

## `getMap()`

Client: `getMap(mapSlug)`\
Socket: `emit("getMap", mapSlug, callback)`\
REST: `GET /map/<mapSlug>`

Retrieves the settings of a single map by map slug. This can also be used to check if a map with a certain slug exists.

Result: [`MapDataWithWritable`](./types.md#mapdatawithwritable)

## `createMap()`

Client (streamed): `createMap(data, { pick?, bbox? })`\
Client (unstreamed): `createMapUnstreamed(data, { pick? })`\
Socket: `emit("createMap", data, { pick? }, callback)`\
REST: `POST /map?pick=<pick?>` (body: `data`)

Creates a new map.

Parameters:
* `data` ([`MapData`](./types.md#mapdata)): The map data
* `pick` (`Array<"mapData" | "types">`, REST: comma-delimited string): The types of map data to return. Defaults to `["mapData", "types"]`.

The result is the result of [`getAllMapObjects()`](#getallmapobjects) for the newly created map, see there for details.

## `updateMap()`

Client: `updateMap(mapSlug, data)`\
Socket: `emit("updateMap", mapSlug, data, callback)`\
REST: `PUT /map/<mapSlug>` (body: `data`)

Update the map settings of the current map.

Parameters:
* `mapSlug` (string): The map slug of the map (this map slug must have admin permission on the map)
* `data` ([`MapData`](./types.md#mapdata): The properties to change

Result: [`MapDataWithWritable`](./types.md#mapdatawithwritable), the updated version of the map settings

If this is called through the socket and the map is currently subscribed, causes a [`mapData`](./events.md#mapdata) event (and a [`mapSlugRename`](./events.md#mapslugrename) event if a map slug was changed) to be emitted before the promise is resolved.

## `deleteMap()`

Client: `deleteMap(mapSlug)`\
Socket: `emit("deleteMap", mapSlug, callback)` \
REST: `DELETE /map/<mapSlug>`

Delete a map irrevocably.

Parameters:
* `mapSlug` (string): The map slug of the map to delete (this map slug must have admin permission on the map)

If this is called through the socket and the map is currently subscribed, causes a [`deleteMap`](./events.md#deletemap) event to be emitted before the promise is resolved.

## `getAllMapObjects()`

Client (streamed): `getAllMapObjects(mapSlug, { pick?, bbox? })`\
Client (unstreamed): `getAllMapObjectsUnstreamed(mapSlug, { pick?, bbox? })`\
Socket: `emit("getAllMapObjects", mapSlug, { pick?, bbox? }, callback)`\
REST: `GET /map/<mapSlug>/all?pick=<pick?>&bbox=<bbox?>`

Returns the whole map data (map settings, types, views, markers, lines).

Parameters:
* `mapSlug` (string): The map slug of the map
* `pick` (`Array<"mapData" | "types" | "views" | "markers" | "lines" | "linesWithTrackPoints" | "linePoints">`, REST: comma-delimited string): The types of data to return. If `bbox` is set, defaults to `["mapData", "types", "views", "markers", "linesWihTrackPoints"]`, otherwise defaults to `["mapData", "types", "views", "lines"]`
* `bbox` ([`Bbox`](./types.md#bbox), REST: JSON-stringified Bbox): Only return markers and line points for this bbox.

The streamed version of this returns the following type:
```typescript
AsyncIterable<
	{ type: "mapData"; data: MapDataWithWritable }
	| { type: "types", data: AsyncIterable<Type> }
	| { type: "views", data: AsyncIterable<View> }
	| { type: "markers", data: AsyncIterable<Marker> }
	| { type: "lines", data: AsyncIterable<Line & { trackPoints?: TrackPoint[] }> }
	| { type: "linePoints", data: AsyncIterable<{ lineId: number; trackPoints: TrackPoint[] > }
>
```

The unstreamed version returns the following type:
```typescript
{
	mapData?: MapDataWithWritable;
	types?: Type[];
	views?: View[];
	markers?: Marker[];
	lines?: Array<Line & { trackPoints?: TrackPoint[] }> };
	linePoints?: Array<{ lineId: number; trackPoints: TrackPoint[] > };
}
```

The Socket API returns the streamed version as a stream ID, see [streams](./advanced.md#streams).

The REST API returns the unstreamed version, but produces the JSON document in a streamed way. It is up to you whether you want to consume it in a streamed way or as a whole.

findOnMap(mapSlug: MapSlug, query: string): Promise<FindOnMapResult[]> {
getHistory(mapSlug: MapSlug, data?: PagingInput): Promise<HistoryEntry[]> {
revertHistoryEntry(mapSlug: MapSlug, historyEntryId: ID): Promise<void> {
getMapMarkers(mapSlug: MapSlug, options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Marker>> {
getMarker(mapSlug: MapSlug, markerId: ID): Promise<Marker> {
createMarker(mapSlug: MapSlug, data: Marker<CRU.CREATE>): Promise<Marker> {
updateMarker(mapSlug: MapSlug, markerId: ID, data: Marker<CRU.UPDATE>): Promise<Marker> {
deleteMarker(mapSlug: MapSlug, markerId: ID): Promise<void> {
getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: MapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>> {
getLine(mapSlug: MapSlug, lineId: ID): Promise<Line> {
getLinePoints(mapSlug: MapSlug, lineId: ID, options?: { bbox?: BboxWithZoom & { except?: Bbox } }): Promise<StreamedResults<TrackPoint>> {
createLine(mapSlug: MapSlug, data: Line<CRU.CREATE>): Promise<Line> {
updateLine(mapSlug: MapSlug, lineId: ID, data: Line<CRU.UPDATE>): Promise<Line> {
deleteLine(mapSlug: MapSlug, lineId: ID): Promise<void> {
exportLine(mapSlug: MapSlug, lineId: ID, options: { format: ExportFormat }): Promise<{ type: string; filename: string; data: ReadableStream<Uint8Array> }> {
getMapTypes(mapSlug: MapSlug): Promise<StreamedResults<Type>> {
getType(mapSlug: MapSlug, typeId: ID): Promise<Type> {
createType(mapSlug: MapSlug, data: Type<CRU.CREATE>): Promise<Type> {
updateType(mapSlug: MapSlug, typeId: ID, data: Type<CRU.UPDATE>): Promise<Type> {
deleteType(mapSlug: MapSlug, typeId: ID): Promise<void> {
getMapViews(mapSlug: MapSlug): Promise<StreamedResults<View>> {
getView(mapSlug: MapSlug, viewId: ID): Promise<View> {
createView(mapSlug: MapSlug, data: View<CRU.CREATE>): Promise<View> {
updateView(mapSlug: MapSlug, viewId: ID, data: View<CRU.UPDATE>): Promise<View> {
deleteView(mapSlug: MapSlug, viewId: ID): Promise<void> {
find(query: string): Promise<SearchResult[]> {
findUrl(url: string): Promise<{ data: ReadableStream<Uint8Array> }> {
getRoute(data: RouteRequest): Promise<RouteInfo> {
geoip(): Promise<Bbox | undefined> {

## `setMapId(mapId)`

Opens the collaborative map with the ID `mapId`.

This method can only be called once, and only if no `mapId` was passed to the constructor. If you want to open a different map, you need to create a new instance of the client.

Setting the mapId causes the server to send several objects, such as the map settings, all views, and all lines (just metadata, without line points). Each of these objects is sent as an individual [`event`](./events.md).

* `mapId` (string): The ID of the collaborative map to open. Can be a read-only ID, writable ID or admin ID of a map.
* **Returns:** A promise that is resolved empty when all objects have been received.
* **Events:** Causes events to be fired with the map settings, all views, all types and all lines (without line points) of the map. If the map could not be opened, causes a [`serverError`](./events.md#servererror) event.
* **Availability:** Only available if no map is opened yet on this client instance.

## `setLanguage(settings)`

Updates the language settings for the current socket connection. Usually this only needs to be called if the user changes their internationalization settings and you want to apply the new settings live in the UI. See [Internationalization](./#internationalization) for the details and how to set the language settings when opening a client.

* `settings`: An object with the following properties:
	* `lang` (optional): The language, for example `en` or `de`.
	* `units` (optional): The units to use, either `metric` or `us_costomary`.
* **Returns:** A promise tat is resolved empty when the settings have been applied.
* **Events:** None.
* **Availability:** Always.

## `updateBbox(bbox)`

Updates the bbox. This will cause all markers, line points and route points within the bbox (except the ones that were already in the previous bbox, if there was one) to be received as individual events.

* `bbox` ([Bbox](./types.md#bbox) with zoom): The bbox that objects should be received for.
* **Returns:** A promise that is resolved empty when all objects have been received.
* **Events:** Causes events to be fired with the markers, line points and route points within the bbox.
* **Availability:** Always.

## `listenToHistory()`

Start listening to the modification history of the map. Calling this will cause multiple `history` objects to be
received (that describe the modification history until now), and new `history` objects will be received every time
something is modified (in addition to the modified object).

* **Returns:** A promise that is resolved empty when all history objects have been received.
* **Events:** Causes multiple [`history`](./events.md#history) events.
* **Availability:** Only if a collaborative map is opened through its admin ID.

## `stopListeningToHistory()`

Stop listening to the modification history of the map.

* **Returns:** A promise that is resolved empty when the command has completed.
* **Events:** None.
* **Availability:** Only if a collaborative map is opened through its admin ID and [`listenToHistory()`](#listentohistory) has been called before.

## `revertHistoryEntry(data)`

Undo a modification in the map. When a previously removed object is restored, it receives a new ID, and thus the object
IDs of all other history entries connected to this object are updated as well. This is why reverting a history entry
will cause the whole history to be received again (as if you were calling `listenToHistory()` again).

* `data` (`{ id: number }`)): The history object that should be reverted.
* **Returns:** A promise that is resolved empty when the command has completed and all new history objects have been received.
* **Events:** Causes multiple [`history`](./events.md#history) events and an event that reverts the change.
* **Availability:** Only if a collaborative map is opened through its admin ID.

## `disconnect()`

Empties all cached objects and disconnects from the server.

## `find(data)`

Search for places. Does not persist anything on the server, simply serves as a proxy to the search service.

* `data` (object): An object with the following properties:
	* `query` (string): The query string
	* `loadUrls` (boolean): Whether to return the file if `query` is a URL
* **Returns:** A promise that is resolved with the following value:
	* If `data.query` is a URL to a GPX/KML/OSM/GeoJSON file and `loadUrls` is `true`, a string with the content of the file.
	* Otherwise an array of [SearchResults](./types.md#searchresult).
* **Events:** None.
* **Availability:** Always.

## `findOnMap(data)`

Search for markers and lines inside the map.

* `data` (object): An object with the following properties:
	* `query` (string): The query string
* **Returns:** A promise that is resolved with an array of (stripped down) [Marker](./types.md#marker) and [Line](./types.md#line) objects. The objects only contain the `id`, `name`, `typeId`, `lat`/`lon` (for markers), `left`/`top`/`right`/`bottom` (for lines) properties, plus an additional `kind` property that is either `"marker"` or `"line"`.
* **Events:** None.
* **Availability:** Only when a map is opened.

## `getRoute(data)`

Calculate a route between two or more points. Does not persist anything on the server, simply serves as a proxy to the routing service.

* `data` (object): An object with the following properties:
	* `destinations` (array): An array of at least two route points (objects with a `lat` and `lon` property)
	* `mode` ([RouteMode](./types.md#routemode)): the route mode
* **Returns:** A promise that is resolved with a [Route](./types.md#route)>.
* **Events:** None.
* **Availability:** Always.

## `setRoute(data)`

Calculate a route between two or more points, but but do not return the track points of the route but cache them on the server side and send them according to the client bbox. The route is not persisted on a collaborative map, but is temporarily persisted on the server in the scope one particular client connection only. As long as the route is active, the server will send [`routePoints`](./events.md#routepoints) events in response to [`updateBbox()`](#updatebbox-bbox) with the track points of the route simplified according to the bbox. The route will stay active until it is cleared using [`clearRoute()`](#clearroute-data) or the connection is closed.

Multiple routes can be active at the same time. They can be distinguished by their `routeId` property, which is a custom string that you can specify when activating a route. A `routeId` needs to be unique in the scope of this client instance, other clients are not affected by it. For backwards compatibility reasons, `undefined` is an acceptable value for `routeId`, but is considered a unique identifier nonetheless.

Calling `setRoute()` with a `routeId` of a route that is already active will replace that route.

The metadata of a route whose `routeId` is `undefined` is persisted in the [`route`](./properties.md#route) property and its track points in `route.trackPoints`. The metadata of a route whose `routeId` is a string is persisted in the [`routes[routeId]`](./properties.md#routes) property and its track points in `routes[routeId].trackPoints`.

* `data` (object): An object with the following properties:
	* `routePoints` (array): An array of at least two route points (objects with a `lat` and `lon` property)
	* `mode` ([RouteMode](./types.md#routemode)): the route mode
	* `routeId` (string or undefined): the custom `routeId` to identify the route
* **Returns:** A promise that is resolved with a [Route](./types.md#route)> object.
* **Events:** Causes a [`route`](./events.md#route) and a [`routePoints`](./events.md#routepoints) event.
* **Availability:** Always.

## `clearRoute(data)`

Clear a temporary route set via [`setRoute(data)`](#setroute-data).

* `data` (object): An object with the following properties:
	* `routeId` (string or undefined): the custom `routeId` to identify the route
* **Returns:** A promise that is resolved empty when the route is cleared.
* **Events:** Causes a [`clearRoute`](./events.md#clearroute) event.
* **Availability:** If a route with the specified `routeId` is active.

## `lineToRoute(data)`

Call [`setRoute()`](#setroute-data) with the parameters of an existing line. Saves time, as the route does not need to be recalculated. If a route with the same `routeId` is already active, it is replaced.

* `data` (object): An object with the following properties:
	* `id` (string): The ID of the line
	* `routeId` (string or undefined): the custom `routeId` to identify the route
* **Returns:** A promise that is resolved with a [Route](./types.md#route)> object.
* **Events:** Causes a [`route`](./events.md#route) and a [`routePoints`](./events.md#routepoints) event.
* **Availability:** Only if a collaborative map is opened.

## `exportRoute(data)`

Export the current route.

* `data` (object): An object with the following properties:
	* `format` (string): One of the following:
		* `gpx-trk`: GPX track (contains the whole course of the route)
		* `gpx-rte`: GPX route (contains only the route points, and the navigation device will have to calculate the route)
	* `routeId` (string or undefined): the custom `routeId` to identify the route
* **Returns:** A promise that is resolved with a string with the file contents.
* **Events:** None.
* **Availability:** if a route with the specified `routeId` is active.

## `getMarker(data)`

Get the marker with the given ID. This is useful if you want to access a specific marker but it is not loaded as part of the current bbox.

* `data` (object): An object with the following properties:
	* `id` (number): The ID of the marker to load
* **Returns:** A promise that is resolved with a [Marker](./types.md#marker)>. If the marker is not found, the promise rejects.
* **Events:** None.
* **Availability:** Only if a collaborative map is opened.

## `addMarker(data)`

Create a marker.

* `data` ([Marker](./types.md#marker)): The data of the marker to create. An `id` will be assigned by the server.
* **Returns:** A promise that is resolved with a [Marker](./types.md#marker)>, with an `id` assigned and possibly its styles modified by the settings of its type.
* **Events:** May trigger a [`marker`](./events.md#marker) event if the created marker is in the current bbox.
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `editMarker(data)`

Update an existing marker.

* `data` ([Marker](./types.md#marker)). The new marker data. Fields that are not defined will not be unmodified. Only `id` needs to be defined.
* **Returns:** A promise that is resolved with the updated [Marker](./types.md#marker). Might have some styles modified due to the settings of its type.
* **Events:** May trigger a [`marker`](./events.md#marker) event if the updated marker is in the current bbox.
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `deleteMarker(data)`

Delete an existing marker

* `data` (`{ id: number }`): an object that contains the ID of the marker to be removed
* **Returns:** An promise that is resolved with the deleted [Marker](./types.md#marker) when the operation has completed.
* **Events:** Causes a [`deleteMarker`](./events.md#deletemarker) event.
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `getLineTemplate(data)`

Get a mock line object for a line with the given type. This can be used so that while the user is drawing a new line,
that line already has the right style.

* `data` (`{ typeId: number }`): An object containing the type ID
* **Returns:** A promise that is resolved with a mock [Line](./types.md#line) with the styles of this type.
* **Events:** None.
* **Availability:** Only if a collaborative map is opened.

## `addLine(data)`

Create a line.

* `data` ([Line](./types.md#line)): The data of the line to create. An `id` will be assigned by the server.
* **Returns:** A promise that is resolved with a [Line](./types.md#line), with an `id` assigned and possibly its styles modified by the settings of its type.
* **Events:** Causes a [`line`](./events.md#line) event and a [`linePoints`](./events.md#linepoints) event (if the line is in the current bbox).
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `editLine(data)`

Update an existing line.

* `data` ([line](./types.md#line)). The new line data. Fields that are not defined will not be unmodified. Only `id` needs to be defined.
* **Returns:** A promise that is resolved with the update [Line](./types.md#line). Might have some styles modified due to the settings of its type.
* **Events:** Causes a [`line`](./events.md#line) event and possibly a [`linePoints`](./events.md#linepoints) event (if the route mode was changed and the line is in the current bbox).
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `deleteLine(data)`

Delete an existing line

* `data` (`{id: <lineId>}`): An object that contains the ID of the line to be removed
* **Returns:** A promise that is resolved with the deleted [Line](./types.md#line) when the operation has completed.
* **Events:** Causes a [`deleteLine`](./events.md#deleteline) event.
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `exportLine(data)`

Export a line.

* `data` (object): An object with the following properties:
	* `id` (string): The ID of the line
	* `format` (string): One of the following:
		* `gpx-trk`: GPX track (contains the whole course of the route)
		* `gpx-rte`: GPX route (contains only the route points, and the navigation device will have to calculate the route)
* **Returns:** A promise that is resolved with a string that contains the file.
* **Events:** None.
* **Availability:** If a collaborative map is opened.

## `addType(data)`

Create a type.

* `data` ([Type](./types.md#type)): The data of the type to create. An `id` will be assigned by the server.
* **Returns:** A promise that is resolved with the created [Type](./types.md#type)>, with an `id` assigned.
* **Events:** Causes a [`type`](./events.md#type) event.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `editType(data)`

Update an existing type.

* `data` ([type](./types.md#type)). The new type data. Fields that are not defined will not be unmodified. Only `id` needs to be defined. To rename a field, set the `oldName` property of the field object to the previous name and the `name` property to the new name. To rename a dropdown entry, set the `oldValue` property to the old value and the `value` property to the new value.
* **Returns:** A promise that is resolved with the updated <[Type](./types.md#type)>.
* **Events:** Causes a [`type`](./events.md#type) event. If the update causes the styles of existing markers or lines to change, events for those are triggered as well.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `deleteType(data)`

Delete an existing type

* `data` (`{id: <typeId>}`): An object that contains the ID of the type to be removed
* **Returns:** A promise that is resolved with the deleted [Type](./types.md#type) when the operation has completed. If there are any objects on the map that still use this type, the promise rejects.
* **Events:** Causes a [`deleteType`](./events.md#deletetype) event.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `addView(data)`

Create a view.

* `data` ([view](./types.md#view)): The data of the view to create. An `id` will be assigned by the server
* **Returns:** A promise that is resolved with the created <[View](./types.md#view)>), with an `id` assigned.
* **Events:** Causes a [`view`](./events.md#view) event.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `editView(data)`

Update an existing view.

* `data` ([view](./types.md#view)). The new view data. Fields that are not defined will not be unmodified. Only `id` needs to be defined.
* **Returns:** A promise that is resolved with the updated <[View](./types.md#view)>).
* **Events:** Causes a [`view`](./events.md#view) event.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `deleteView(data)`

Delete an existing view

* `data` (`{id: <viewId>}`): An object that contains the ID of the view to be removed
* **Returns:** A promise that is resolved when the operation has completed.
* **Events:** Causes a [`deleteView`](./events.md#deleteview) event.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `geoip()`

Returns an approximate location for the IP address of the client.

* **Returns:** A promise that is resolved to a [bounding box](./types.md#bbox) (without zoom) that includes the location of the client. If no location can be determined, the promise is resolved with `undefined`.
* **Events:** None.
* **Availability:** Always.