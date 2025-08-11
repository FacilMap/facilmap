# API Methods

## `findMaps()`

Client: `findMaps(query, { start?, limit? })`\
Socket: `emit("findMaps", query, { start?, limit? }, callback)`\
REST: `GET /maps?query=<query>&start=<start?>&limit=<limit?>`

Finds collaborative maps by a search term. Only finds maps that have been made public by setting <code>[searchEngines](./types.md#mapdata)</code> to `true`.

Parameters:
* `query` (string): The search term
* `start`, `limit` (number): See [paging](./types.md#paging)

Result: <code>[PagedResults](./types.md#pagedresults)&lt;Pick&lt;[MapData](./types.md#mapdata), &quot;id&quot; | &quot;readId&quot; | &quot;name&quot; | &quot;description&quot;&gt;&gt;</code>

## `getMap()`

Client: `getMap(mapSlug)` or `mapSubscription.getMap()`\
Socket: `emit("getMap", mapSlug, callback)`\
REST: `GET /maps/<mapSlug>`

Retrieves the settings of a single map by map slug. This can also be used to check if a map with a certain slug exists.

Result: <code>[MapData](./types.md#mapdata)</code>

## `createMap()`

Client (streamed): `createMap(data, { pick? })`\
Client (unstreamed): `createMapUnstreamed(data, { pick? })`\
Socket: `emit("createMap", data, { pick? }, callback)`\
REST: `POST /maps?pick=<pick?>` (body: `data`)

Creates a new map.

Parameters:
* `data` (<code>[MapData](./types.md#mapdata)</code>): The map data
* `pick` (`Array<"mapData" | "types">`, REST: comma-delimited string): The types of map data to return. Defaults to `["mapData", "types"]`.

The result is the result of <code>[getAllMapObjects()](#getallmapobjects)</code> for the newly created map, see there for details.

## `updateMap()`

Client: `updateMap(mapSlug, data)` or `mapSubscription.updateMap(data)`\
Socket: `emit("updateMap", mapSlug, data, callback)`\
REST: `PUT /maps/<mapSlug>` (body: `data`)

Update the map settings of the current map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map (this map slug must have admin permission on the map)
* `data` (<code>[MapData](./types.md#mapdata)</code>): The properties to change

Result: <code>[MapData](./types.md#mapdata)</code>, the updated version of the map settings

If this is called through the socket and the map is currently subscribed, causes a <code>[mapData](./events.md#mapdata)</code> event to be emitted before the promise is resolved.

If the used map slug is changed as part of this request, the resulting `MapData` object will already contain the new slug. The `mapData` event sent by the socket if the map is subscribed will contain a `MapData` event with the updated map (containing the new slug), but the `mapSlug` parameter of the event will still be the old map slug so that clients can react to the change. Any future events will use the new `mapSlug`.

Changing a map slug will make everyone who is using that slug lose access to the map, even if they have it in their favourites or if they have the map currently open. Changing a map password will make those who have the map currently open have to reenter the password.

## `deleteMap()`

Client: `deleteMap(mapSlug)` or `mapSubscription.deleteMap()`\
Socket: `emit("deleteMap", mapSlug, callback)` \
REST: `DELETE /maps/<mapSlug>`

Delete a map irrevocably.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map to delete (this map slug must have admin permission on the map)

If this is called through the socket and the map is currently subscribed, causes a <code>[deleteMap](./events.md#deletemap)</code> event to be emitted before the promise is resolved.

## `getAllMapObjects()`

Client (streamed): `getAllMapObjects(mapSlug, { pick?, bbox? })` or `mapSubscription.getAllMapObjects({ pick?, bbox? })`\
Client (unstreamed): `getAllMapObjectsUnstreamed(mapSlug, { pick?, bbox? })` or `mapSubscription.getAllMapObjectsUnstreamed({ pick?, bbox? })`\
Socket: `emit("getAllMapObjects", mapSlug, { pick?, bbox? }, callback)`\
REST: `GET /maps/<mapSlug>/all?pick=<pick?>&bbox=<bbox?>`

Returns the whole map data (map settings, types, views, markers, lines).

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `pick` (`Array<"mapData" | "types" | "views" | "markers" | "lines" | "linesWithTrackPoints" | "linePoints">`, REST: comma-delimited string): The types of data to return. If `bbox` is set, defaults to `["mapData", "types", "views", "markers", "linesWihTrackPoints"]`, otherwise defaults to `["mapData", "types", "views", "lines"]`
* `bbox` (<code>[Bbox](./types.md#bbox)</code>, REST: JSON-stringified): Only return markers and line points for this bbox.

The streamed version of this returns the following type:
```typescript
AsyncIterable<
	{ type: "mapData"; data: MapData }
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
	mapData?: MapData;
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

Client: `findOnMap(mapSlug, query)` or `mapSubscription.findOnMap(query)`\
Socket: `emit("findOnMap", mapSlug, query, callback)`\
REST: `GET /maps/<mapSlug>/find?query=<query>`

Search for markers and lines inside the map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map to search
* `query` (string): The search term

Result: `Array<FindOnMapResult>`, an array of stripped down <code>[Marker](./types.md#marker)</code> and <code>[Line](./types.md#line)</code> objects:

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

At the moment, the method returns markers/lines whose name contains the search term, although this might be extended in the future. The results are sorted by similarity – the `similarity` property is a number between 0 and 1, with 1 meaning that the marker/line name is exactly identical with the search term.

## `getMapToken()`

Client: `getMapToken(mapSlug, { permissions, noPassword? })` or `mapSubscription.getMapToken({ permissions, noPassword? })`\
Socket: `emit("getMapToken", mapSlug, { permissions, noPassword? }, callback)`\
REST: `GET /maps/<mapSlug>/token?permissions=<permissions>&noPassword=<noPassword?>`

Creates a token that can be used as a map slug for API calls. This allows creating read-only or password-less equivalents for map links. More details can be found under [map slugs and tokens](./advanced.md#map-slugs-tokens-and-passwords).

Map tokens have no expiration date, but they are directly associated with the map link that they are created for. This means that changing a map link affects map tokens previously created for it. A map token references its associated map link by map ID and slug. This means that when a map slug is changed, tokens created for it become invalid, but when the slug is changed back, the token become valid again. Tokens generated with `noPassword` are also associated to the map link password. If the password is changed, such tokens become invalid, but if the password is changed back, they become valid again.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug for which to generate a token
* `permissions` (<code>[MapPermissions](./types.md#mappermissions)</code>, REST: JSON-stringified): The permissions that the token should have. `admin` permission is not allowed. Other permissions are ignored if they are higher level than the permissions of the map slug.
* `noPassword` (boolean): If this is set to `true`, the token can be used without a password, even if a password is required for its associated map link. The token will be associated with the existing password, so if the password of the map link is changed, the token will stop working.

Result: `{ token: string }`

## `getHistory()`

Client: `getHistory(mapSlug, { start?, limit? })` or `mapSubscription.getHistory({ start?, limit? })`\
Socket: `emit("getHistory", mapSlug, { start?, limit? }, callback)`\
REST: `GET /maps/<mapSlug>/history?start=<start?>&limit=<limit?>`

Returns a list of changes that have been made on the map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `start`, `limit` (number): See [paging](./types.md#paging)

Result: <code>Array&lt;[HistoryEntry](./types.md#historyentry)&gt;</code>

## `revertHistoryEntry()`

Client: `revertHistoryEntry(mapSlug, historyEntryId)` or `mapSubscription.revertHistoryEntry(historyEntryId)`\
Socket: `emit("revertHistoryEntry", mapSlug, historyEntryId)`\
REST: `POST /maps/<mapSlug>/history/<historyEntryId>/revert`

Undo a modification on the map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `historyEntryId` (number): The ID of the history entry to revert

Reverting a history entry on a subscribed map will emit a socket event to create/delete/update the respective object. It will also create a new history entry for the revert action itself. Using the Socket Client/API, The events are guaranteed to be delivered before the returned promise is resolved.

Reverting a history entry has the following effect:
* `create` action: The object will be deleted
* `update` action: The version before the entry will be restored
* `delete` action: The last version of the object before the entry will be recreated as a new object. The new object will have the same ID that it used to have.

## `getMapMarkers()`

Client: `getMapMarkers(mapSlug, { bbox?, typeId? }` or `mapSubscription.getMapMarkers({ bbox?, typeId? })`\
Socket: `emit("getMapMarkers", mapSlug, { bbox?, typeId? }, callback)`\
REST: `GET /maps/<mapSlug>/markers?bbox=<bbox>&typeId=<typeId>`

Returns all the markers on the map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `bbox` ([BboxWithExcept](./types.md#bboxwithexcept), REST: JSON-stringified): If specified, only retrieve markers wthin this bbox
* `typeId` (number): If specified, only retrieve markers of this type.

Result:
* Client: <code>{ results: AsyncIterable&lt;[Marker](./types.md#marker)&gt; }</code>
* Socket: `{ results: string }` (containing a [stream ID](./advanced.md#streams))
* REST: <code>{ results: Array&lt;[Marker](./types.md#marker)&gt; }</code>

## `getMarker()`

Client: `getMarker(mapSlug, markerId)` or `mapSubscription.getMarker(markerId)`\
Socket: `emit("getMarker", mapSlug, markerId, callback)`\
REST: `GET /maps/<mapSlug>/markers/<markerId>`

Return a single marker from the map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `markerId` (number): The ID of the marker

Result: <code>[Marker](./types.md#marker)</code>

## `createMarker()`

Client: `createMarker(mapSlug, marker)` or `mapSubscription.createMarker(marker)`\
Socket: `emit("createMarker", mapSlug, marker, callback)`\
REST: `POST /maps/<mapSlug>/markers` (body: `marker`)

Create a marker.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `marker` (<code>[Marker](./types.md#marker)</code>): The marker to create

Result: <code>[Marker](./types.md#marker)</code>, the created marker with all its properties. Some style properties might be different than requested if the type enforces certain styles.

If you don’t set the elevation of the marker, it will be determined on the server asynchronously. This means that the `ele` property of the returned marker will be `null`, but if you fetch the marker again a few seconds later, it will contain a number. When using the Socket API, you will receive this update in the form of a `marker` event.

## `updateMarker()`

Client: `updateMarker(mapSlug, markerId, marker)` or `mapSubscription.updateMarker(markerId, marker)`\
Socket: `emit("updateMarker", mapSlug, markerId, marker, callback)`\
REST: `PUT /maps/<mapSlug>/markers/<markerId>` (body: `marker`)

Update an existing marker.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `markerId` (number): The ID of the marker to update
* `marker` (<code>[Marker](./types.md#marker)</code>): The marker properties to update

Result: <code>[Marker](./types.md#marker)</code>, the updated marker with all its properties. Some style properties might be different than requested if the type enforces certain styles.

If you update the marker position but don’t set an elevation as part of the update, the elevation will be determined on the server asynchronously. This means that the `ele` property of the returned marker will be `null`, but if you fetch the marker again a few seconds later, it will contain a number. When using the Socket API, you will receive this update in the form of a `marker` event.

## `deleteMarker()`

Client: `deleteMarker(mapSlug, markerId)` or `mapSubscription.deleteMarker(markerId)`\
Socket: `emit("deleteMarker", mapSlug, markerId, callback)`\
REST: `DELETE /maps/<mapSlug>/markers/<markerId>`

Delete an existing marker

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `markerId` (number): The ID of the marker to delete

## `getMapLines()`

Client: `getMapLines(mapSlug, { bbox?, includeTrackPoints?, typeId? })` or `mapSubscription.getMapLines({ bbox?, includeTrackPoints?, typeId? })`\
Socket: `emit("getMapLines", mapSlug, { bbox?, includeTrackPoints?, typeId? }, callback)`\
REST: `GET /maps/<mapSlug>/lines?bbox=<bbox?>&includeTrackPoints=<includeTrackPoints?>&typeId=<typeId?>`

Get the lines of a map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `bbox` ([BboxWithExcept](./types.md#bboxwithexcept), REST: JSON-stringified): If specified, only retrieve data wthin this bbox. Currently, this only affects the track points and all lines are always returned, but this might be adjusted in the future and only lines that overlap with the bbox are returned at all.
* `includeTrackPoints` (boolean, REST: `true` or `false`): If set to `true`, the returned lines will have an additional `trackPoints` property (<code>Array&lt;[TrackPoint](./types.md#trackpoint)&gt;</code>) containing the track points of the line.
* `typeId` (number): If specified, only return lines of this type.

Result:
* Client: <code>{ results: AsyncIterable&lt;[Line](./types.md#line)&gt; }</code>
* Socket: `{ results: string }` (containing a [stream ID](./advanced.md#streams))
* REST: <code>{ results: Array&lt;[Line](./types.md#line)&gt; }</code>

## `getLine()`

Client: `getLine(mapSlug, lineId)` or `mapSubscription.getLine(lineId)`\
Socket: `emit("getLine", mapSlug, lineId, callback)`\
REST: `GET /maps/<mapSlug>/lines/<lineId>`

Get a single line on the map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `lineId` (number): The ID of the line

Result: <code>[Line](./types.md#line)</code>

## `getLinePoints()`

Client: `getLinePoints(mapSlug, lineId, { bbox? })` or `mapSubscription.getLinePoints(lineId, { bbox? })`\
Socket: `emit("getLinePoints", mapSlug, lineId, { bbox? }, callback)`\
REST: `GET /maps/<mapSlug>/lines/<lineId>/linePoints?bbox=<bbox?>`

Returns the track points of a single line.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `lineId` (number): The ID of the number
* `bbox` (<code>[BboxWithExcept](./types.md#bboxwithexcept)</code>, REST: JSON-stringified): If specified, only return track points within this bbox.

Result:
* Client: <code>{ results: AsyncIterable&lt;[TrackPoint](./types.md#trackpoint)&gt; }</code>
* Socket: `{ results: string }` (containing a [stream ID](./advanced.md#streams))
* REST: <code>{ results: Array&lt;[TrackPoint](./types.md#trackpoint)&gt; }</code>

## `getLineTemplate()`

Client: `getLineTemplate(mapSlug, { typeId })` or `mapSubscription.getLineTemplate({ typeId })`\
Socket: `emit("getLineTemplate", mapSlug, { typeId }, callback)`\
REST: `GET /maps/<mapSlug>/lines/template?typeId=<typeId>`

Get a mock line object for a line with the given type. This can be used so that while the user is drawing a new line, that line already has the right style.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `typeId` (number): The ID of the type that the line will have

Result: <code>Pick&lt;[Line](./types.md#line), &quot;typeId&quot; | &quot;name&quot; | &quot;colour&quot; | &quot;data&quot; | &quot;mode&quot; | &quot;width&quot; | &quot;stroke&quot;</code>

In a JavaScript/TypeScript app, it would be preferrable to call `getLineTemplate(type)` exported by `facilmap-utils`, as that can be called synchronously.

## `createLine()`

Client: `createLine(mapSlug, line)` or `mapSubscription.createLine(line)`\
Socket: `emit("createLine", mapSlug, line, callback)`\
REST: `POST /maps/<mapSlug>/lines` (body: `line`)

Create a line.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `line` (<code>[Line](./types.md#line)</code>): The line to create

Result: <code>[Line](./types.md#line)</code>, the created line with all its properties. Some style properties might be different than requested if the type enforces certain styles.

## `updateLine()`

Client: `updateLine(mapSlug, lineId, line)` or `mapSubscription.updateLine(lineId, line)`\
Socket: `emit("updateLine", mapSlug, lineId, line, callback)`\
REST: `PUT /maps/<mapSlug>/lines/<lineId>` (body: `line`)

Update an existing line.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `lineId` (number): The ID of the line to update
* `line` (<code>[Line](./types.md#line)</code>): The line properties to update

Result: <code>[Line](./types.md#line)</code>, the updated line with all its properties. Some style properties might be different than requested if the type enforces certain styles.

If the `routePoints` and/or `mode` of the line are modified, causes the route to be recalculated and its track points to be replaced. If the `routePoints` and `mode` are equal to a currently subscribed route (see <code>[subscribeToRoute](#subscribetoroute)</code>), the track points of the route are copied to the line on the server rather than calculating the route again, which saves time.

## `deleteLine()`

Client: `deleteLine(mapSlug, lineId)` or `mapSubscription.deleteLine(lineId)`\
Socket: `emit("deleteLine", mapSlug, lineId, callback)`\
REST: `DELETE /maps/<mapSlug>/lines/<lineId>`

Delete an existing line

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `lineId` (number): The ID of the line to delete

## `exportLine()`

Client: `exportLine(mapSlug, lineId, { format })` or `mapSubscription.exportLine(lineId, { format })`\
Socket: `emit("exportLine", mapSlug, lineId, { format }, callback)`\
REST: `GET /maps/<mapSlug>/lines/<lineId>/export?format=<format>`

Export a single line from a map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `lineId` (number): The ID of the line to export
* `format` (`"gpx-trk" | "gpx-rte" | "geojson"`): The desired export format. `"gpx-trk"` exports all the track points of the line, whereas `"gpx-rte"` only exports the route points.

Result:
* Client: `{ type: string; filename: string; data: ReadableStream<Uint8Array> }`
* Socket: `{ type: string; filename: string; data: string }`, where `data` is a [stream ID](./advanced.md#streams)
* REST: The response body is the exported file; the MIME type and the file name are sent as part of the `Content-Type` and `Content-Disposition` HTTP headers.

## `getMapTypes()`

Client: `getMapTypes(mapSlug)` or `mapSubscription.getMapTypes()`\
Socket: `emit("getMapTypes", mapSlug, callback)`\
REST: `GET /maps/<mapSlug>/types`

Returns all the types of the map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map

Result:
* Client: <code>{ results: AsyncIterable&lt;[Type](./types.md#type)&gt; }</code>
* Socket: `{ results: string }` (containing a [stream ID](./advanced.md#streams))
* REST: <code>{ results: Array&lt;[Type](./types.md#type)&gt; }</code>

## `getType()`

Client: `getType(mapSlug, typeId)` or `mapSubscription.getType(typeId)`\
Socket: `emit("getType", mapSlug, typeId, callback)`\
REST: `GET /maps/<mapSlug>/types/<typeId>`

Get a single type of the map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `typeId` (number): The ID of the type

Result: <code>[Type](./types.md#type)</code>

## `createType()`

Client: `createType(mapSlug, type)` or `mapSubscription.createType(type)`\
Socket: `emit("createType", mapSlug, type, callback)`\
REST: `POST /maps/<mapSlug>/types` (body: `type`)

Create a type.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `type` (<code>[Type](./types.md#type)</code>): The data of the type to create

Result: <code>[Type](./types.md#type)</code>, the created type

## `updateType()`

Client: `updateType(mapSlug, typeId, type)` or `mapSubscription.updateType(typeId, type)`\
Socket: `emit("updateType", mapSlug, typeId, type, callback)`\
REST: `PUT /maps/<mapSlug>/types/<typeId>` (body: `type`)

Update an existing type.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `typeId` (number): The ID of the type to update
* `type` (<code>[Type](./types.md#type)</code>): The type properties to update

Result: <code>[Type](./types.md#type)</code>, the updated type with all its properties


## `deleteType()`

Client: `deleteType(mapSlug, typeId)` or `mapSubscription.deleteType(typeId)`\
Socket: `emit("deleteType", mapSlug, typeId, callback)`\
REST: `DELETE /maps/<mapSlug>/types/<typeId>`

Delete an existing type

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `typeId` (number): The ID of the type to delete.

## `getMapViews()`

Client: `getMapViews(mapSlug)` or `mapSubscription.getMapViews()`\
Socket: `emit("getMapViews", mapSlug, callback)`\
REST: `GET /maps/<mapSlug>/views`

Returns all the views of the map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map

Result:
* Client: <code>{ results: AsyncIterable&lt;[View](./types.md#view)&gt; }</code>
* Socket: `{ results: string }` (containing a [stream ID](./advanced.md#streams))
* REST: <code>{ results: Array&lt;[View](./types.md#view)&gt; }</code>

## `getView()`

Client: `getView(mapSlug, viewId)` or `mapSubscription.getView(viewId)`\
Socket: `emit("getView", mapSlug, viewId, callback)`\
REST: `GET /maps/<mapSlug>/views/<viewId>`

Get a single view of the map.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `viewId` (number): The ID of the view

Result: <code>[View](./types.md#view)</code>

## `createView()`

Client: `createView(mapSlug, view)` or `mapSubscription.createView(view)`\
Socket: `emit("createView", mapSlug, view, callback)`\
REST: `POST /maps/<mapSlug>/views` (body: `view`)

Create a view.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `view` (<code>[View](./types.md#view)</code>): The data of the view to create

Result: <code>[View](./types.md#view)</code>, the created view

## `updateView()`

Client: `updateView(mapSlug, viewId, view)` or `mapSubscription.updateView(viewId, view)`\
Socket: `emit("updateView", mapSlug, viewId, view, callback)`\
REST: `PUT /maps/<mapSlug>/views/<viewId>` (body: `view`)

Update an existing view.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `viewId` (number): The ID of the view to update
* `view` (<code>[View](./types.md#view)</code>): The view properties to update

Result: <code>[View](./types.md#view)</code>, the updated view with all its properties


## `deleteView()`

Client: `deleteView(mapSlug, viewId)` or `mapSubscription.deleteView(viewId)`\
Socket: `emit("deleteView", mapSlug, viewId, callback)`\
REST: `DELETE /maps/<mapSlug>/views/<viewId>`

Delete an existing view

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map
* `viewId` (number): The ID of the view to delete.


## `find()`

Client: `find(query)`\
Socket: `emit("find", query, callback)`\
REST: `GET /find?query=<query>`

Search for places. Does not persist anything on the server, simply serves as a proxy to the search service.

Parameters:
* `query` (string): The search term

Result: <code>Array&lt;[SearchResult](./types.md#searchresult)&gt;</code>

## `findUrl()`

Client: `findUrl(url)`\
Socket: `emit("findUrl", url, callback)`\
REST: `GET /find/url?url=<url>`

Load a geographic file from a publicly accessible URL. Does not persist anything on the server, simply serves as a proxy to access the file without being limited by the Same-Origin Policy.

Result:
* Client: `{ data: ReadableStream<Uint8Array> }`
* Socket: `{ data: string }`, where `data` is a [stream ID](./advanced.md#streams)
* REST: The response body is the exported file.

## `getRoute()`

Client: `getRoute({ routePoints, mode })`\
Socket: `getRoute({ routePoints, mode }, callback)`\
REST: `GET /route?routePoints=<routePoints>&mode=<mode>`

Calculate a route between two or more points. Does not persist anything on the server, simply serves as a proxy to the routing service.

Parameters:
* `routePoints` (`Array<{ lat: number; lon: number }>`, REST: JSON-stringified): The list of destinations
* `mode` (string, see [route mode](./types.md#route-mode)): The route mode

Result: <code>[Route](./types.md#route)</code> without `routePoints` and `mode`

## `geoip()`

Client: `geoip()`\
Socket: `emit("geoip", callback)`\
REST: `GET /geoip`

Returns an approximate location for the IP address of the client.

Result: <code>[Bbox](./types.md#bbox)</code> without `zoom`

## `subscribeToMap()`

Client: `subscribeToMap(mapSlug, { pick?, history?, identity? })`\
Socket: `emit("subscribeToMap", mapSlug, { pick?, history?, identity? }, callback)`\
REST: _not available_

Enables the reception of events for objects of the map and their changes.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug of the map to subscribe to. In this case, the `identity` cannot be provided as part of the `mapSlug` but instead passed as a separate property.
* `pick` (`Array<"mapData" | "types" | "views" | "markers" | "lines" | "linePoints">`): The types of objects to subscribe to. Defaults to all of them.
* `history` (boolean): Whether to retrieve history entries. Defaults to `false`.
* `identity` (`string | string[] | null`): The identity, see <code>[MapSlug](./types.md#mapslug)</code>. When updating an existing map subscription, omitting the `identity` will keep the current one, while setting it to `null` will clear the current identity.

When using the Client, a map subscription object will be returned, see <code>[SocketClient.subscribeToMap()](./classes.md#subscribetomap)</code>. Calling `subscribeToMap()` with a map slug that is already subscribed will throw an error. To update an existing subscription, use <code>[mapSubscription.updateSubscription()](./classes.md#updatesubscription)</code>. On the contrary, when using the Socket API directly, `subscribeToMap()` acts as a way to enable _and_ to update a subscription. When called with a map slug that is already subscribed, it updates the subscription.

When `subscribeToMap()` is called to subscribe to a map, all the subscribed map objects of the map are emitted in their current version (with the exception of history entries, these have to be fetched separately). These events are guaranteed to arrive before the returned promise is resolved. While the subscription is active, events will be emitted about objects of the subscribed types being created, updated or deleted. All events emitted by the subscription will use the map slug with which you subscribed to the map, but keep in mind that the map slug might be edited (indicated by a <code>[mapSlugRename](./events.md#mapslugrename)</code> event).

The subscription respects the bbox set by <code>[setBbox()](#setbbox)</code>. If you subscribe to the map when no bbox is set yet, no markers and line points are emitted, even if you subscribed to them. When you call `setBbox()`, the markers and line points for the new bbox are emitted.

If you update an active map subscription, only newly subscribed object types are emitted as events as part of the update operation. For example, subscribing to a map using `const mapSubscription = await client.subscribeToMap("mymap", { pick: ["mapData"] })` will trigger a `mapData` event before the promise is resolved. Calling `await mapSubscription.updateSubscription({ pick: ["mapData", "types"] })` will trigger multiple `type` events (but no `mapData` event, as the map data was already sent the first time) before its promise is resolved. In addition, `mapData` events are emitted whenever the map data is changed while the subscription is active (whether before or after the `updateSubscription()` call).

If you update the identity of an active map subscription, markers/lines are reemitted (if they are subscribed to), since their visibility and the visibility of their fields might changed depending on whether the new identity owns them. Markers/lines that were previously emitted but aren’t now are not visible to the new identity and no updates will be received for them.

Note that when the socket connection is interrupted, the server will forget about the subscription. The Client will automatically reestablish the subscription on reconnection, but when using the Socket API directly, you will have to do it manually (see [connection problems](./README.md#deal-with-connection-problems)).

Trying to subscribe to a map that does not exist will throw an error that has a `status: 404` property. In this case (and _only_ in this case) the server will annul the subscription, meaning that `unsubscribeFromMap()` would throw an error, but you can call `createMapAndSubscribe()` to create the map.

## `createMapAndSubscribe()`

Client: `createMapAndSubscribe(mapData, { pick?, history? })`\
Socket: `emit("createMapAndSubscribe", mapData, { pick?, history? }, callback)`\
REST: _not available_

A combination of <code>[createMap()](#createmap)</code> and <code>[subscribeToMap()](#subscribetomap)</code> that creates a map, emits its initial data and subscribes to its changes.

Currently, the subscription will be active using the first map link that has `admin` permission. This behaviour may be refined in the future. You can get the actual map link that was used for the subscription from the `activeLink` property of the returned <code>[MapData](./types.md#mapdata)</code> object, or by using the `getMainAdminLink(mapData.links)` function exported by `facilmap-types`.

Parameters:
* `mapData` (<code>[MapData](./types.md#mapdata)</code>): The data to create the map with
* `pick` (`Array<"mapData" | "types" | "views" | "markers" | "lines" | "linePoints">`): The types of objects to subscribe to. Defaults to all of them.
* `history` (boolean): Whether to retrieve history entries.
* `identity` (`string | string[]`): The identity to subscribe with, see <code>[MapSlug](./types.md#mapslug)</code>.

## `unsubscribeFromMap()`

Client: `mapSubscription.unsubscribe()`\
Socket: `emit("unsubscribeFromMap", mapSlug, callback)`\
REST: _not available_

Stop receiving events for the given map slug.

Parameters:
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>): The map slug with which the map is subscribed.

## `subscribeToRoute()`

Client: `subscribeToRoute(routeKey, { routePoints, mode } | { mapSlug, lineId })`\
Socket: `emit("subscribeToRoute", routeKey, { routePoints, mode } | { mapSlug, lineId }, callback)`\
REST: _not available_

Calculate a route between two and more points and subscribe to its track points in response to <code>[setBbox()](#setbbox)</code> calls.

Parameters:
* `routeKey` (string): An arbitrary identifier for the route. Events for the route can be identified by this key. Needs to be unique within the scope of the individual socket connection. If you are not intending to subscribe to multiple routes at once, feel free to use an empty string as the route key.
* `routePoints` (`Array<{ lat: number; lon: number }>`, at least 2): The way points along which to calculate the route
* `mode` (string, see [route mode](./types.md#route-mode)): The route mode to use for calculating the route
* `mapSlug` (<code>[MapSlug](./types.md#mapslug)</code>) and `lineId` (number): If these are specified, use the route points and mode of this line from a map instead. The server does not need to calculate the route again, but instead can directly return the track points of the line. This is useful for an “edit waypoints” feature where users can edit the route parameters and see the resulting route before finally saving them. (Calling <code>[updateLine()](#updateline)</code> with route parameters that are currently subscribed will copy the track points so that the server doesn’t have to calculate the route again.)

Subscribing to a route will calculate the route on the server side and cache its track points temporarily until the route is unsubscribed again or the socket is disconnected. The route only exists within the scope of an individual socket connection, it cannot be accessed by other users. When subscribing to a route or updating a route subscription, the server will send a <code>[route](./events.md#route)</code> event with the route metadata, and, if a bbox is currently set, a <code>[routePoints](./events.md#routepoints)</code> event for the track points within the current bbox. While the route is subscribed, `routePoints` events will be emitted whenever the bbox is updated using <code>[setBbox](#setbbox)</code>.

When using the Client, this will return a route subscription object, see <code>[SocketClient.subscribeToRoute()](./classes.md#subscribetoroute)</code>. Calling `subscribeToRoute()` with a route key that is already used by an active route subscription in the same socket connection will throw an error. To change the parameters of an active route subscription, use <code>[routeSubscription.updateSubscription()](./classes.md#updatesubscription-1)</code> instead. On the contrary, when using the Socket API directly, `subscribeToRoute()` is used to update a route subscription when called with a route key that is already subscribed.

Note that when the socket connection is interrupted, the server will forget about the subscription. The Client will automatically reestablish the subscription on reconnection, but when using the Socket API directly, you will have to do it manually (see [connection problems](./README.md#deal-with-connection-problems)).

## `unsubscribeFromRoute()`

Client: `routeSubscription.unsubscribe()`\
Socket: `emit("unsubscribeFromRoute", routeKey, callback)`\
REST: _not available_

Stop receiving events for the route with the given key and clear its track points from the database on the server side.

Parameters:
* `routeKey` (string): The route key that was used to subscribe to the route.

## `exportRoute()`

Client: `exportRoute(routeKey, { format })` or `routeSubscription.exportRoute({ format })`\
Socket: `emit("exportRoute", routeKey, { format }, callback)`\
REST: _not available_

Export a route that is subscribed.

Parameters:
* `routeKey` (string): The route key that was used to subscribe to the route
* `format` (`"gpx-trk" | "gpx-rte" | "geojson"`): The desired export format. `"gpx-trk"` exports all the track points of the route, whereas `"gpx-rte"` only exports the route points.

Result:
* Client: `{ type: string; filename: string; data: ReadableStream<Uint8Array> }`
* Socket: `{ type: string; filename: string; data: string }`, where `data` is a [stream ID](./advanced.md#streams)

## `setBbox()`

Client: `setBbox(bbox)`\
Socket: `emit("setBbox", bbox, callback)`\
REST: _not available_

Update the bbox for this socket connection.

Parameters:
* `bbox` (<code>[Bbox](./types.md#bbox)</code>): The new bbox

The bbox set by this will apply to all active map and route subscriptions that were made on the current socket connection using <code>[subscribeToMap()](#subscribetomap)</code>, <code>[createMapAndSubscribe()](#createmapandsubscribe)</code> or <code>[subscribeToRoute()](#subscribetoroute)</code>. Calling `setBbox()` will cause those subscriptions to emit `marker`, `linePoints` and `routePoints` events containing data within the bbox (data from the previous bbox is omitted to avoid unnecessary duplication); these events are guaranteed to arrive before the returned promise is resolved. When markers or line points are created, updated or deleted, events about this are sent to all the connected sockets in whose current bbox these objects reside.

Note that when the socket connection is interrupted, the server will forget about the current bbox. The Client will automatically set the bbox again on reconnection, but when using the Socket API directly, you will have to do it manually (see [connection problems](./README.md#deal-with-connection-problems)).

## `setLanguage()`

Client: `setLanguage({ lang?, units? })`\
Socket: `emit("setLanguage", { lang?, units? }, callback)`\
REST: _not available_

Update the language settings for the current socket connection.

Parameters:
* `lang` (string): The language code, such as `en`
* `units` (`"metric" | "us_customary"`): The units to use

This method is meant for cases where a user changes the language settings while a socket connection is active. See the chapter about [internationalization](./advanced.md#internationalization) for other ways to apply language settings.