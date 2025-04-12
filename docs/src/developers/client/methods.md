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
* `bbox` ([`Bbox`](./types.md#bbox), REST: JSON-stringified): Only return markers and line points for this bbox.

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

## `findOnMap()`

Client: `findOnMap(mapSlug, query)`\
Socket: `emit("findOnMap", mapSlug, query, callback)`\
REST: `GET /map/<mapSlug>/find?query=<query>`

Search for markers and lines inside the map.

Parameters:
* `mapSlug` (string): The map slug of the map to search
* `query` (string): The search term

Result: `FindOnMapResult[]`:

```typescript
type FindOnMapMarker = Pick<Marker, "id" | "name" | "typeId" | "lat" | "lon" | "icon"> & {
	kind: "marker";
	similarity: number;
};
type FindOnMapLine = Pick<Line, "id" | "name" | "typeId" | "left" | "top" | "right" | "bottom"> & {
	kind: "line";
	similarity: number;
};
type FindOnMapResult = FindOnMapMarker | FindOnMapLine;
```

Returns an array of stripped down [`Marker`](./types.md#marker) and [`Line`](./types.md#line) objects.

At the moment, the method returns markers/lines whose name contains the search term, although this might be improved in the future. The results are sorted by similarity – the `similary` property is a number between 0 and 1, with 1 meaning that the marker/line name is exactly identical with the search term.

## `getHistory()`

Client: `getHistory(mapSlug, { start?, limit? })`\
Socket: `emit("getHistory", mapSlug, { start?, limit? }, callback)`\
REST: `GET /map/<mapSlug>/history?start=<start?>&limit=<limit?>`

Returns a list of changes that have been made on the map.

Parameters:
* `mapSlug` (string): The map slug of the map
* `start`, `limit` (number): See [paging](./types.md#paging)

Result: `Array<`[`HistoryEntry`](./types.md#historyentry)`>`

## `revertHistoryEntry()`

Client: `revertHistoryEntry(mapSlug, historyEntryId)`\
Socket: `emit("revertHistoryEntry", mapSlug, historyEntryId)`\
REST: `POST /map/<mapSlug>/history/<historyEntryId>/revert`

Undo a modification on the map.

Parameters:
* `mapSlug` (string): The map slug of the map
* `historyEntryId` (number): The ID of the history entry to revert

When using the socket, reverting a history entry on a subscribed map will emit an event to create/delete/update the respective object. It will also create a new history entry for the revert action itself. The events are guaranteed to be delivered before the returned promise is resolved.

Reverting a history entry has the following effect:
* `create` action: The object will be deleted
* `update` action: The version before the entry will be restored
* `delete` action: The last version of the object before the entry will be recreated as a new object. The new object will have a different ID than it previously had. All the history entries related to the object will be updated to contain the new ID. This means that if the map is subscribed, various `historyEntry` events may be emitted to update the historic entries.

## `getMapMarkers()`

Client: `getMapMarkers(mapSlug, { bbox?, typeId? }`\
Socket: `emit("getMapMarkers", mapSlug, { bbox?, typeId? }, callback)`\
REST: `GET /map/<mapSlug>/marker?bbox=<bbox>&typeId=<typeId>`

Returns all the markers on the map.

Parameters:
* `mapSlug` (string): The map slug of the map
* `bbox` ([BboxWithExcept](./types.md#bboxwithexcept), REST: JSON-stringified): If specified, only retrieve markers wthin this bbox
* `typeId` (number): If specified, only retrieve markers of this type.

Result:\
Client: `{ results: AsyncIterable<`[`Marker`](./types.md#marker)`> }`\
Socket: `{ results: string }` (containing a [stream ID](./advanced.md#streams))\
REST: `{ results: Array<`[`Marker`](./types.md#marker)`> }`

## `getMarker()`

Client: `getMarker(mapSlug, markerId)`\
Socket: `emit("getMarker", mapSlug, markerId, callback)`\
REST: `GET /map/<mapSlug>/marker/<markerId>`

Return a single marker from the map.

Parameters:
* `mapSlug` (string): The map slug of the map
* `markerId` (number): The ID of the marker

Result: [`Marker`](./types.md#marker)

## `createMarker()`

Client: `createMarker(mapSlug, marker)`\
Socket: `emit("createMarker", mapSlug, marker, callback)`\
REST: `POST /map/<mapSlug>/marker` (body: `marker`)

Create a marker.

Parameters:
* `mapSlug` (string): The map slug of the map
* `marker` ([`Marker`](./types.md#marker)): The marker to create

Result: [`Marker`](./types.md#marker), the created marker with all its properties. Some style properties might be different than requested if the type enforces certain styles.

## `updateMarker()`

Client: `updateMarker(mapSlug, markerId, marker)`\
Socket: `emit("updateMarker", mapSlug, markerId, marker, callback)`\
REST: `PUT /map/<mapSlug>/marker/<markerId>` (body: `marker`)

Update an existing marker.

Parameters:
* `mapSlug` (string): The map slug of the map
* `markerId` (number): The ID of the marker to update
* `marker` ([`Marker`](./types.md#marker)): The marker properties to update

Result: [`Marker`](./types.md#marker), the updated marker with all its properties. Some style properties might be different than requested if the type enforces certain styles.

## `deleteMarker()`

Client: `deleteMarker(mapSlug, markerId)`\
Socket: `emit("deleteMarker", mapSlug, markerId, callback)`\
REST: `DELETE /map/<mapSlug>/marker/<markerId>`

Delete an existing marker

Parameters:
* `mapSlug` (string): The map slug of the map
* `markerId` (number): The ID of the marker to delete

## `getMapLines()`

Client: `getMapLines(mapSlug, { bbox?, includeTrackPoints?, typeId? })`\
Socket: `emit("getMapLines", mapSlug, { bbox?, includeTrackPoints?, typeId? }, callback)`\
REST: `GET /map/<mapSlug>/line?bbox=<bbox?>&includeTrackPoints=<includeTrackPoints?>&typeId=<typeId?>`

Get the lines of a map.

Parameters:
* `mapSlug` (string): The map slug of the map
* `bbox` ([BboxWithExcept](./types.md#bboxwithexcept), REST: JSON-stringified): If specified, only retrieve data wthin this bbox. Currently, this only affects the track points and all lines are always returned, but this might be adjusted in the future and only lines that overlap with the bbox are returned at all.
* `includeTrackPoints` (boolean, REST: `true` or `false`): If set to `true`, the returned lines will have an additional `trackPoints` property (`Array<`[`TrackPoint`](./types.md#trackpoint)`>`) containing the track points of the line.
* `typeId` (number): If specified, only return lines of this type.

Result:\
Client: `{ results: AsyncIterable<`[`Line`](./types.md#line)`> }`\
Socket: `{ results: string }` (containing a [stream ID](./advanced.md#streams))\
REST: `{ results: Array<`[`Line`](./types.md#line)`> }`

## `getLine()`

Client: `getLine(mapSlug, lineId)`\
Socket: `emit("getLine", mapSlug, lineId, callback)`\
REST: `GET /map/<mapSlug>/line/<lineId>`

Get a single line on the map.

Parameters:
* `mapSlug` (string): The map slug of the map
* `lineId` (number): The ID of the line

Result: [`Line`](./types.md#line)

## `getLinePoints()`

Client: `getLinePoints(mapSlug, lineId, { bbox? })`\
Socket: `emit("getLinePoints", mapSlug, lineId, { bbox? }, callback)`\
REST: `GET /map/<mapSlug>/line/<lineId>/linePoints?bbox=<bbox?>`

Returns the track points of a single line.

Parameters:
* `mapSlug` (string): The map slug of the map
* `lineId` (number): The ID of the number
* `bbox` ([`BboxWithExcept](./types.md#bboxwithexcept), REST: JSON-stringified): If specified, only return track points within this bbox.

Result:\
Client: `{ results: AsyncIterable<`[`TrackPoint`](./types.md#trackpoint)`> }`\
Socket: `{ results: string }` (containing a [stream ID](./advanced.md#streams))\
REST: `{ results: Array<`[`TrackPoint`](./types.md#trackpoint)`> }`

## `createLine()`

Client: `createLine(mapSlug, line)`\
Socket: `emit("createLine", mapSlug, line, callback)`\
REST: `POST /map/<mapSlug>/line` (body: `line`)

Create a line.

Parameters:
* `mapSlug` (string): The map slug of the map
* `line` ([`Line`](./types.md#line)): The line to create

Result: [`Line`](./types.md#line), the created line with all its properties. Some style properties might be different than requested if the type enforces certain styles.

## `updateLine()`

Client: `updateLine(mapSlug, lineId, line)`\
Socket: `emit("updateLine", mapSlug, lineId, line, callback)`\
REST: `PUT /map/<mapSlug>/line/<lineId>` (body: `line`)

Update an existing line.

Parameters:
* `mapSlug` (string): The map slug of the map
* `lineId` (number): The ID of the line to update
* `line` ([`Line`](./types.md#line)): The line properties to update

Result: [`Line`](./types.md#line), the updated line with all its properties. Some style properties might be different than requested if the type enforces certain styles.

## `deleteLine()`

Client: `deleteLine(mapSlug, lineId)`\
Socket: `emit("deleteLine", mapSlug, lineId, callback)`\
REST: `DELETE /map/<mapSlug>/line/<lineId>`

Delete an existing line

Parameters:
* `mapSlug` (string): The map slug of the map
* `lineId` (number): The ID of the line to delete

## `exportLine()`

Client: `exportLine(mapSlug, lineId, { format })`\
Socket: `emit("exportLine", mapSlug, lineId, { format }, callback)`\
REST: `GET /map/<mapSlug>/line/<lineId>/export?format=<format>`

Export a single line from a map.

Parameters:
* `mapSlug` (string): The map slug of the map
* `lineId` (number): The ID of the line to export
* `format` (`"gpx-trk" | "gpx-rte" | "geojson"`): The desired export format. `"gpx-trk"` exports all the track points of the line, whereas `"gpx-rte"` only exports the route points.

Result:\
Client: `{ type: string; filename: string; data: ReadableStream<Uint8Array> }`\
Socket: `{ type: string; filename: string; data: string }`, where `data` is a [stream ID](./advanced.md#streams)\
REST: The response body is the exported file; the MIME type and the file name are sent as part of the `Content-Type` and `Content-Disposition` HTTP headers.

## `getMapTypes()`

Client: `getMapTypes(mapSlug)`\
Socket: `emit("getMapTypes", mapSlug, callback)`\
REST: `GET /map/<mapSlug>/type`

Returns all the types of the map.

Parameters:
* `mapSlug` (string): The map slug of the map

Result:\
Client: `{ results: AsyncIterable<`[`Type`](./types.md#type)`> }`\
Socket: `{ results: string }` (containing a [stream ID](./advanced.md#streams))\
REST: `{ results: Array<`[`Type`](./types.md#type)`> }`

## `getType()`

Client: `getType(mapSlug, typeId)`\
Socket: `emit("getType", mapSlug, typeId, callback)`\
REST: `GET /map/<mapSlug>/type/<typeId>`

getType(mapSlug: MapSlug, typeId: ID): Promise<Type> {

## `createType()`

createType(mapSlug: MapSlug, data: Type<CRU.CREATE>): Promise<Type> {

	Create a type.

* `data` ([Type](./types.md#type)): The data of the type to create. An `id` will be assigned by the server.
* **Returns:** A promise that is resolved with the created [Type](./types.md#type)>, with an `id` assigned.
* **Events:** Causes a [`type`](./events.md#type) event.
* **Availability:** Only if a collaborative map is opened using its admin link.


## `updateType()`

updateType(mapSlug: MapSlug, typeId: ID, data: Type<CRU.UPDATE>): Promise<Type> {

	Update an existing type.

* `data` ([type](./types.md#type)). The new type data. Fields that are not defined will not be unmodified. Only `id` needs to be defined. To rename a field, set the `oldName` property of the field object to the previous name and the `name` property to the new name. To rename a dropdown entry, set the `oldValue` property to the old value and the `value` property to the new value.
* **Returns:** A promise that is resolved with the updated <[Type](./types.md#type)>.
* **Events:** Causes a [`type`](./events.md#type) event. If the update causes the styles of existing markers or lines to change, events for those are triggered as well.
* **Availability:** Only if a collaborative map is opened using its admin link.


## `deleteType()`

deleteType(mapSlug: MapSlug, typeId: ID): Promise<void> {

	Delete an existing type

* `data` (`{id: <typeId>}`): An object that contains the ID of the type to be removed
* **Returns:** A promise that is resolved with the deleted [Type](./types.md#type) when the operation has completed. If there are any objects on the map that still use this type, the promise rejects.
* **Events:** Causes a [`deleteType`](./events.md#deletetype) event.
* **Availability:** Only if a collaborative map is opened using its admin link.


## `getMapViews()`

getMapViews(mapSlug: MapSlug): Promise<StreamedResults<View>> {

## `getView()`

getView(mapSlug: MapSlug, viewId: ID): Promise<View> {

## `createView()`

createView(mapSlug: MapSlug, data: View<CRU.CREATE>): Promise<View> {

	Create a view.

* `data` ([view](./types.md#view)): The data of the view to create. An `id` will be assigned by the server
* **Returns:** A promise that is resolved with the created <[View](./types.md#view)>), with an `id` assigned.
* **Events:** Causes a [`view`](./events.md#view) event.
* **Availability:** Only if a collaborative map is opened using its admin link.


## `updateView()`

updateView(mapSlug: MapSlug, viewId: ID, data: View<CRU.UPDATE>): Promise<View> {

	Update an existing view.

* `data` ([view](./types.md#view)). The new view data. Fields that are not defined will not be unmodified. Only `id` needs to be defined.
* **Returns:** A promise that is resolved with the updated <[View](./types.md#view)>).
* **Events:** Causes a [`view`](./events.md#view) event.
* **Availability:** Only if a collaborative map is opened using its admin link.


## `deleteView()`

deleteView(mapSlug: MapSlug, viewId: ID): Promise<void> {

	Delete an existing view

* `data` (`{id: <viewId>}`): An object that contains the ID of the view to be removed
* **Returns:** A promise that is resolved when the operation has completed.
* **Events:** Causes a [`deleteView`](./events.md#deleteview) event.
* **Availability:** Only if a collaborative map is opened using its admin link.


## `find()`

find(query: string): Promise<SearchResult[]> {

Search for places. Does not persist anything on the server, simply serves as a proxy to the search service.

* `data` (object): An object with the following properties:
	* `query` (string): The query string
	* `loadUrls` (boolean): Whether to return the file if `query` is a URL
* **Returns:** A promise that is resolved with the following value:
	* If `data.query` is a URL to a GPX/KML/OSM/GeoJSON file and `loadUrls` is `true`, a string with the content of the file.
	* Otherwise an array of [SearchResults](./types.md#searchresult).
* **Events:** None.
* **Availability:** Always.

## `findUrl()`

findUrl(url: string): Promise<{ data: ReadableStream<Uint8Array> }> {

## `getRoute()`

getRoute(data: RouteRequest): Promise<RouteInfo> {

	Calculate a route between two or more points. Does not persist anything on the server, simply serves as a proxy to the routing service.

* `data` (object): An object with the following properties:
	* `destinations` (array): An array of at least two route points (objects with a `lat` and `lon` property)
	* `mode` ([RouteMode](./types.md#routemode)): the route mode
* **Returns:** A promise that is resolved with a [Route](./types.md#route)>.
* **Events:** None.
* **Availability:** Always.

## `geoip()`

geoip(): Promise<Bbox | undefined> {

	Returns an approximate location for the IP address of the client.

* **Returns:** A promise that is resolved to a [bounding box](./types.md#bbox) (without zoom) that includes the location of the client. If no location can be determined, the promise is resolved with `undefined`.
* **Events:** None.
* **Availability:** Always.

## `subscribeToMap()`

subscribeToMap(mapSlug: MapSlug, options?: SubscribeToMapOptions): SocketClientMapSubscription & BasicPromise<SocketClientMapSubscription> {

	Opens the collaborative map with the ID `mapId`.

This method can only be called once, and only if no `mapId` was passed to the constructor. If you want to open a different map, you need to create a new instance of the client.

Setting the mapId causes the server to send several objects, such as the map settings, all views, and all lines (just metadata, without line points). Each of these objects is sent as an individual [`event`](./events.md).

* `mapId` (string): The ID of the collaborative map to open. Can be a read-only ID, writable ID or admin ID of a map.
* **Returns:** A promise that is resolved empty when all objects have been received.
* **Events:** Causes events to be fired with the map settings, all views, all types and all lines (without line points) of the map. If the map could not be opened, causes a [`serverError`](./events.md#servererror) event.
* **Availability:** Only available if no map is opened yet on this client instance.

Start listening to the modification history of the map. Calling this will cause multiple `history` objects to be
received (that describe the modification history until now), and new `history` objects will be received every time
something is modified (in addition to the modified object).

* **Returns:** A promise that is resolved empty when all history objects have been received.
* **Events:** Causes multiple [`history`](./events.md#history) events.
* **Availability:** Only if a collaborative map is opened through its admin ID.

Stop listening to the modification history of the map.

* **Returns:** A promise that is resolved empty when the command has completed.
* **Events:** None.
* **Availability:** Only if a collaborative map is opened through its admin ID and [`listenToHistory()`](#listentohistory) has been called before.

## `createMapAndSubscribe()`

createMapAndSubscribe(data: MapData<CRU.CREATE>, options?: SubscribeToMapOptions): SocketClientMapSubscription & BasicPromise<SocketClientMapSubscription> {

## `unsubscribeFromMap()`

async _unsubscribeFromMap(mapSlug: MapSlug): Promise<void>

## `subscribeToRoute()`

subscribeToRoute(routeKey: string, params: DeepReadonly<RouteParameters | LineToRouteRequest>): SocketClientRouteSubscription & BasicPromise<SocketClientRouteSubscription> {

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


Call [`setRoute()`](#setroute-data) with the parameters of an existing line. Saves time, as the route does not need to be recalculated. If a route with the same `routeId` is already active, it is replaced.

* `data` (object): An object with the following properties:
	* `id` (string): The ID of the line
	* `routeId` (string or undefined): the custom `routeId` to identify the route
* **Returns:** A promise that is resolved with a [Route](./types.md#route)> object.
* **Events:** Causes a [`route`](./events.md#route) and a [`routePoints`](./events.md#routepoints) event.
* **Availability:** Only if a collaborative map is opened.


## `unsubscribeFromRoute()`

async _unsubscribeFromRoute(routeKey: string): Promise<void> {

Clear a temporary route set via [`setRoute(data)`](#setroute-data).

* `data` (object): An object with the following properties:
	* `routeId` (string or undefined): the custom `routeId` to identify the route
* **Returns:** A promise that is resolved empty when the route is cleared.
* **Events:** Causes a [`clearRoute`](./events.md#clearroute) event.
* **Availability:** If a route with the specified `routeId` is active.

## `exportRoute()`

async exportRoute(routeKey: string, data: { format: ExportFormat }): ReturnType<ApiV3<true>["exportLine"]> {

	Export the current route.

* `data` (object): An object with the following properties:
	* `format` (string): One of the following:
		* `gpx-trk`: GPX track (contains the whole course of the route)
		* `gpx-rte`: GPX route (contains only the route points, and the navigation device will have to calculate the route)
	* `routeId` (string or undefined): the custom `routeId` to identify the route
* **Returns:** A promise that is resolved with a string with the file contents.
* **Events:** None.
* **Availability:** if a route with the specified `routeId` is active.

## `setBbox()`

async setBbox(bbox: BboxWithZoom): Promise<void> {

	Updates the bbox. This will cause all markers, line points and route points within the bbox (except the ones that were already in the previous bbox, if there was one) to be received as individual events.

* `bbox` ([Bbox](./types.md#bbox) with zoom): The bbox that objects should be received for.
* **Returns:** A promise that is resolved empty when all objects have been received.
* **Events:** Causes events to be fired with the markers, line points and route points within the bbox.
* **Availability:** Always.

## `setLanguage()`

async setLanguage(language: SetLanguageRequest): Promise<void> {

Updates the language settings for the current socket connection. Usually this only needs to be called if the user changes their internationalization settings and you want to apply the new settings live in the UI. See [Internationalization](./#internationalization) for the details and how to set the language settings when opening a client.

* `settings`: An object with the following properties:
	* `lang` (optional): The language, for example `en` or `de`.
	* `units` (optional): The units to use, either `metric` or `us_costomary`.
* **Returns:** A promise tat is resolved empty when the settings have been applied.
* **Events:** None.
* **Availability:** Always.




## `getLineTemplate(data)`

Get a mock line object for a line with the given type. This can be used so that while the user is drawing a new line,
that line already has the right style.

* `data` (`{ typeId: number }`): An object containing the type ID
* **Returns:** A promise that is resolved with a mock [Line](./types.md#line) with the styles of this type.
* **Events:** None.
* **Availability:** Only if a collaborative map is opened.
