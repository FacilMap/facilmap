FacilMap client API
===================

* [Properties](#properties)
* [Events](#events)
* [Methods](#methods)
* [Types](#types-1)

Properties
----------

All objects that are received from the server are cached in properties of the client object.

All objects that can be part of a map have an `id`. Note that when an object is updated, the whole object is replaced in
these properties, so be careful to not cache outdated versions of objects:

```js
let myMarker = client.markers[myMarkerId];
setTimeout(() => {
	// Bad! A client.markers[myMarkerId] might have been replaced if the marker
	// has been changed in the meantime, and we are using the old version.
	doSomethingWithMarker(myMarker);
}, 10000);

setTimeout(() => {
	// Better! Always get objects directly from the client cache.
	doSomethingWithMarker(client.markers[myMarkerId]);
});

// If you need to keep an object copy, make sure to keep it updated
client.on("marker", (marker) => {
	if(marker.id == myMarkerId)
		myMarker = marker;
});
```

### `padId`

The ID under which the client is connected to the map. Can be the read-only or a read-write ID of an existing map.

Note that the ID can be changed in the settings. If in case of a [`padData`](#paddata-1) event, the ID of the pad has
changed, this property is updated automatically.

_Type:_ string

### `readonly`

`true` if the map has been opened using its read-only ID. `false` if the map is writable.

_Type:_ boolean

### `writable`

`2` if the map has been opened using its admin ID, `1` if if has been opened using the writable ID, `0` if the map is read-only.

_Type:_ number

### `padData`

The current settings of the map. `writeId` and/or `adminId` is null if if has been opened using another ID than the admin ID.

_Type:_ [padData](#paddata-2)

### `markers`

All markers that have been retrieved so far.

_Type:_ `{"<marker id>": `[`marker`](#marker-1)`}`

### `lines`

All lines and their track points that have been retrieved so far.

_Type:_ `{"<line id>": `[`line with trackPoints`](#line-1)`}`

### `views`

All views that have been retrieved so far.

_Type:_ `{"<view id>": `[`view`](#view-1)`}`

### `types`

All types that have been retrieved so far.

_Type:_ `{"<type id>": `[`type`](#type-1)`}`

### `history`

All history entries that have been retrieved so far. Note that you have to subscribe to the history using
[`listenToHistory()`](#listentohistory).

_Type:_ `{"<entry id>": `[`historyEntry`](#historyentry)`}`

### `route`

Information about the temporary route set using [`setRoute()`](#setRoutedata).

_Type:_ [`route`](#route-1)

### `serverError`

If the opening the pad failed ([`setPadId(padId)`](#setpadidpadid) promise got rejected), the error message is stored
in this property.


Events
------

Subscribe to events using the [`on(eventName, function)`](#oneventname-function) method. Example:

```js
let client = new FacilMap.Client("https://facilmap.org/", "testPad");
client.on("padData", (padData) => {
	document.title = padData.name;
});
```

### `connect`, `connect_error`, `connect_timeout`, `reconnect`, `reconnect_attempt`, `reconnecting`, `reconnect_error`, `reconnect_failed`

These events come from socket.io and are [documented there under the section “Events”](http://socket.io/docs/client-api/).

### `padData`

The settings of the map have changed or are retrieved for the first time.

Note that when this event is fired, the read-only and/or the read-write ID of the map might have changed. The [`padId`](#padid)
property is updated automatically.

_Type:_ [padData](#paddata-2)

### `marker`

An existing marker is retrieved for the first time, has been modified, or a new marker has been created in the current bbox.

_Type:_ [marker](#marker-1)

### `deleteMarker`

A marker has been removed. This event is emitted for all markers in the map, even if they are outside of the current bbox
(in case that a marker outside of the current bbox is cached).

_Type:_ `{id: "<markerId>"}`

### `line`

An existing line is retrieved for the first time, has been modified, or a new line has been created. Note that line
objects only contain the line metadata, not its track points (those are handled separately as `linePoints`). This is why
all line objects of the map are sent to the client, regardless of the current bbox.

_Type:_ [line without trackPoints](#line-1)

### `deleteLine`

A line has been removed.

_Type:_ `{id: "<lineId>"}`

### `linePoints`

New track points for an existing line are retrieved after a change of bbox (`reset == false`), or the line has been
modified, so the new track points are retrieved (`reset == true`).

_Type:_ {
* __id__ (number): The ID of the line that these track points belong to
* __reset__ (boolean): Whether to remove all cached track points for this line (`true`) or to merge these track points
  with the cached ones (`false`).
* __trackPoints__ (Array<[trackPoint](#trackpoint)>): The track points

}

### `view`

A view is retrieved for the first time, has been modified, or a new view has been created.

_Type:_ [view](#view-1)

### `deleteView`

A view has been removed.

_Type:_ `{id: "<viewId>"}`

### `type`

A type is retrieved for the first time, has been modified, or a new type has been created.

_Type:_ [type](#type-1)

### `deleteType`

A type has been removed.

_Type:_ `{id: "<typeId>"}`

### `history`

An entry of the modification history is retrieved for the first time, or a new entry has been created due to something
being modified. Note that this event is only fired when the client has subscribed using [`listenToHistory()`](#listentohistory).
 
 _Type:_ [historyEntry](#historyentry)
 
### `routePoints`

New track points for the temporary route are retrieved after a change of bbox.

_Type:_ Array<[trackPoint](#trackpoint)>
 
### `loadStart`, `loadEnd`

This event is fired every time some request is sent to the server and when the response has arrived. It can be used to
display a loading indicator to the user. Note that multiple things can be loading at the same time. Example code:

```js
let loading = 0;
client.on("loadStart", () => {
	++loading;
	showLoadingIndicator();
});
client.on("loadEnd", () => {
	if(--loading == 0)
		hideLoadingIndicator();
});
```

Methods
-------

### `constructor(server, padId)`

Connects to the FacilMap server `server` and optionally opens the collaborative map with the ID `padId`. If the pad ID
is not set, it can be set later using [`setPadId(padId)`](#setpadidpadid) or using [`createPad(data)`](#createpaddata).

Setting the padId causes the server to send several objects, such as the map settings, all views, all types, and all
lines (just meta data, without line points).

If the connection to the server breaks down, a `disconnect` event will be emitted and socket.io will attempt to reconnect.
On successful reconnection, a `reconnect` and `connect` event will be fired.

* `server` (string): The URL of the FacilMap server, for example `https://facilmap.org/`
* `padId` (string, optional): The ID of the collaborative map to open

### `on(eventName, function)`

Registers a new [event](#events) handler.

* `eventName` (string): The name of the event
* `function` (function): The function that should be executed when the event occurs. If the event emits an object,
  it will be passed to the function as the first parameter.

### `removeListener(eventName, function)`

Unregisters an event handler previously assigned using `on(eventName, function)`.

* `eventName` (string): The name of the event
* `function` (function): The function that was passed to `on(eventName, function)` when registering the handler

### `setPadId(padId)`

Opens the collaborative map with the ID `padId`.

This method can only be called once, and only if no `padId` has been passed to the constructor. If you want to open
a different map, you need to create a new instance of the client.

Setting the padId causes the server to send several objects, such as the map settings, all views, and all lines (just
meta data, without line points).

* `padId` (string): The ID of the collaborative map to open
* _returns_ (Promise): A promise that resolves when all objects have been received.

### `updateBbox(bbox)`

Updates the bbox. This will cause all markers and line points within the bbox (except the ones that were already in the
previous bbox, if there was one) to be received.

* __bbox__ ([bbox](#bbox) with zoom): The bbox that objects should be received for
* _returns_ (Promise): A promise that resolves when all objects have been received.

### `createPad(data)`

Creates a new collaborative map.

* `data` ([padData](#paddata-2)): The data of the new map, including the desired read-only and writable ID
* _returns_ (Promise): A promise that resolves when the map has been created, returning the new padData.

### `editPad(data)`

* `data` ([padData](#paddata-2)): The data of the map that should be modified. Fields that are not defined will not be
  modified. To change the default view, set the `defaultViewId` property. The `defaultView` property is ignored.
* _returns_ (Promise): The new padData.

### `listenToHistory()`

Start listening to the modification history of the map. Calling this will cause multiple `history` objects to be
received (that describe the modification history until now), and new `history` objects will be received every time
something is modified (in addition to the modified object).

* _returns_ (Promise): A promise that resolves when all history objects have been received

### `stopListeningToHistory()`

Stop listening to the modification history of the map.

* _returns_ (Promise): A promise that resolves when the command has completed.

### `revertHistoryEntry(data)`

Undo a modification in the map. When a previously removed object is restored, it receives a new ID, and thus the object
IDs of all other history entries connected to this object are updated as well. This is why reverting a history entry
will cause the whole history to be received again (as if you were calling `listenToHistory()` again).

* `data` (`{id: "<historyEntryId>"}`)): The history object that should be reverted
* _returns_ (Promise): A promise that resolves when the command has completed and all new history objects have been received

### `disconnect()`

Empties all cached objects and disconnects from the server.

### `find(data)`

Search for places.

* `data` (object): An object with the following properties:
    * `query` (string): The query string
    * `loadUrls` (string): Whether to return the file if `query` is a URL
* _returns_ (Promise<string|Array<[searchResult](#searchresult)>>): If `data.query` is a URL to a GPX/KML/OSM/GeoJSON
  file, that file as a string, otherwise an array of search results.

### `getRoute(data)`

Calculate a route between two or more points.

* `data` (object): An object with the following properties:
    * `destinations` (array): An array of at least two route points (objects with a `lat` and `lon` property)
    * `mode` (string): `"car"`, `"bicycle"` or `"pedestrian"`
* _returns_ (Promise<[route](#route-1)>)

### `setRoute(data)`

Calculate a route between two or more points, but but do not return the track points of the route but cache them on the
server side and send them according to the client bbox. The properties of the route are saved in the [`route`](#route)
property and the trackPoints in `route.trackPoints`. Only one temporary route like this can be set at a time, when
calling `setRoute()` again, the existing route will be modified.

* `data` (object): An object with the following properties:
    * `routePoints` (array): An array of at least two route points (objects with a `lat` and `lon` property)
    * `mode` (string): `"car"`, `"bicycle"` or `"pedestrian"`
    * `elevation` (boolean): `true` to get elevation data for the route
* _returns_ (Promise<[route](#route-1)>)

### `clearRoute()`

Clear the temporary route set via [`setRoute(data)`](#setroutedata).

* _returns_ (Promise)

### `addMarker(data)`

Create a marker.

* `data` ([marker](#marker-1)): The data of the marker to create. An `id` will be assigned by the server
* _returns_ (Promise<[marker](#marker-1)>): The marker as it is on the server, with an `id` assigned and possibly its
  styles modified by the settings of its type.

### `editMarker(data)`

Update an existing marker.

* `data` ([marker](#marker-1)). The new marker data. Fields that are not defined will not be unmodified. Only `id` needs
  to be defined.
* _returns_ (Promise<[marker](#marker-1)>): The new marker. Might have some styles modified due to the settings of its type

### `deleteMarker(data)`

Delete an existing marker

* `data` (`{id: <markerId>}`): An object that contains the ID of the marker to be removed
* _returns_ (Promise): A promise that resolves when the operation has completed

### `getLineTemplate(data)`
 
Get a fake line object for a line with the given type. This can be used so that while the user is drawing a new line,
that line already has the right style.

* `data` (`{typeId: <typeId>}`): An object containing the type ID
* _returns_ (Promise<[line](#line-1)): A fake line object with the styles of this type

### `addLine(data)`

Create a line.

* `data` ([line](#line)): The data of the line to create. An `id` will be assigned by the server
* _returns_ (Promise<[line](#line-1)>): The line as it is on the server, with an `id` assigned and possibly its
  styles modified by the settings of its type.

### `editLine(data)`

Update an existing line.

* `data` ([line](#line-1)). The new line data. Fields that are not defined will not be unmodified. Only `id` needs
  to be defined.
* _returns_ (Promise<[line](#line-1)>): The new line. Might have some styles modified due to the settings of its type

### `deleteLine(data)`

Delete an existing line

* `data` (`{id: <lineId>}`): An object that contains the ID of the line to be removed
* _returns_ (Promise): A promise that resolves when the operation has completed

### `addType(data)`

Create a type.

* `data` ([type](#type-1)): The data of the type to create. An `id` will be assigned by the server
* _returns_ (Promise<[type](#type-1)>): The type as it is on the server, with an `id` assigned.

### `editType(data)`

Update an existing type.

* `data` ([type](#type-1)). The new type data. Fields that are not defined will not be unmodified. Only `id` needs
  to be defined.
  To rename a field, set the `oldName` property of the field object to the previous name and the `name` property to the
  new name. To rename a dropdown entry, set the `oldValue` property to the old value and the `value` property to the new
  value.
* _returns_ (Promise<[type](#type-1)>): The new type.

### `deleteType(data)`

Delete an existing type

* `data` (`{id: <typeId>}`): An object that contains the ID of the type to be removed
* _returns_ (Promise): A promise that resolves when the operation has completed

### `addView(data)`

Create a view.

* `data` ([view](#view-1)): The data of the view to create. An `id` will be assigned by the server
* _returns_ (Promise<[view](#view-1)>): The view as it is on the server, with an `id` assigned.

### `editView(data)`

Update an existing view.

* `data` ([view](#view-1)). The new view data. Fields that are not defined will not be unmodified. Only `id` needs
  to be defined.
* _returns_ (Promise<[view](#view-1)>): The new view.

### `deleteView(data)`

Delete an existing view

* `data` (`{id: <viewId>}`): An object that contains the ID of the view to be removed
* _returns_ (Promise): A promise that resolves when the operation has completed

Types
-----

### bbox

A bounding box that describes which part of the map the user is currently viewing.

* `top` (number, min: -90, max: 90): The latitude of the north end of the box
* `bottom` (number, min: -90, max: 90): The latitude of the south end of the box
* `left` (number, min: -180, max: 180): The longitude of the west end of the box
* `right` (number, min: -180, max: 180): The longitude of the east end of the box
* `zoom` (number, min: 1, max: 20): The current zoom level. This is relevant for the density of track points that
  should be received. 

### marker

* `id` (number): The ID of this marker
* `lat` (number, min: -90, max: 90): The latitude of this marker
* `lon` (number, min: -90, max: 90): The longitude of this marker
* `name` (string): The name of this marker
* `colour` (string): The colour of this marker as a 6-digit hex value, for example `ff0000`
* `size` (number, min: 15): The height of the marker in pixels
* `symbol` (string): The symbol code for the marker. Default is an empty string.
* `elevation` (number): The elevation of this marker in metres (set by the server)
* `typeId` (number): The ID of the type of this marker
* `data` (`{"key", "value"}`): The filled out form fields of the marker

### line

Each line has `routePoints` and `trackPoints`. The `routePoints` are the start, end and via points that the user created
for that line, the `trackPoints` describe how the line should be drawn. If no routing is used, `routePoints` and
`trackPoints` are equal, but with routing, there will be a lot more `trackPoints` than `routePoints`.

When creating or updating a line, the `trackPoints`, `distance` and `time` properties are automatically calculated by
the server. Only when the routing mode is `track`, the `trackPoints` can be specified by hand (meant for importing
existing tracks, for example from a GPX file). The `idx`, `zoom` and `ele` properties of the track points are added by
the server automatically.

Note that `line` objects coming from the server don’t contain the `trackPoints` property, but the track points are sent
separately through `linePoints` events.

* `id` (number): The ID of this line
* `routePoints` (`[{lat, lon}]`): The route points
* `mode` (string): The routing mode, an empty string for no routing, or `car`, `bicycle`, `pedestrian`, or `track`
* `colour` (string): The colour of this marker as a 6-digit hex value, for example `0000ff`
* `width` (number, min: 1): The width of the line
* `name` (string): The name of the line
* `distance` (number): The distance of the line in kilometers (set by the server)
* `ascent`, `descent` (number): The total ascent/descent of the line in metres (set by the server)
* `time` (number): The time it takes to travel the route in seconds (only if routing mode is `car`, `bicycle` or `pedestrian`) (set by the server)
* `typeId` (number): The ID of the type of this line
* `data` (`{"key", "value"}`): The filled out form fields of the line
* `trackPoints`:
  * In the `lines` property of the client, an object of the format `{"<idx>": trackPoint}`
  * When creating/updating a line with the routing mode `track`, an array of the format `[trackPoint]`

### trackPoint

All track points have a `zoom` level and are only received when the zoom level of the current bbox is at least that
level. This makes sure that at a small zoom level, only a low resolution of the line has to be downloaded. When zooming
in, only the additional track points are retrieved. They can be merged into the already retrieved track points using
their `idx` property.

* `idx` (number): The index of this track point in the list of all track points of this line
* `lat` (number, min: -90, max: 90): The latitude of this point
* `lon` (number, min: -180, max: 180): The longitude of this point
* `zoom` (number, min: 1, max: 20): The miminum zoom level from which this track point makes sense to show
* `ele` (number): The elevation of this track point in metres (set by the server). Not set for high zoom levels.

### padData

* `id` (string): The read-only ID of this map
* `writeId` (string): The read-write ID of this map
* `adminId` (string): The admin ID of this map
* `name` (string): The name of this map
* `searchEngines` (boolean): Whether search engines may index the read-only version of this map
* `description` (string): The description for search engines
* `defaultViewId` (number): The ID of the default view (if any)
* `defaultView` ([view](#view-1)): A copy of the default view object

### view

* `id` (number): The ID of this view
* `name` (string): The name of this view
* `baseLayer` (string): The key of the base layer in this view
* `layers` ([string]): An array of activated overlays in this view
* `top`, `bottom`, `left`, `right`: The [bbox](#bbox) of this view
* `filter` (string): If set, filter the objects according to this filtrex expression

### historyEntry

* `id` (number): The ID of this history entry
* `time` (Date): The time when the modification was done
* `type` (string): The type of object that was modified, one of `Marker`, `Line`, `View`, `Type`, `Pad`
* `action` (string): The action that was done, one of `create`, `update, `delete`
* `objectId` (number): The ID of the object that was modified (null if the object was the map itself)
* `objectBefore` (object): The object before the modification (null if `action` is `create`)
* `objectAfter` (object): The object after the modification (null if `action` is `delete`)

### type

* `id` (number): The ID of this type
* `name` (string): The name of this type
* `type` (string): `marker` or `line`
* `defaultColour`, `defaultSize`, `defaultSymbol`, `defaultWidth`, `defaultMode` (string/number): Default values for the
  different object properties
* `colourFixed`, `sizeFixed`, `symbolFixed`, `widthFixed`, `modeFixed` (boolean): Whether those values are fixed and
  cannot be changed for an individual object
* `fields` ([object]): The form fields for this type. Each field has the following properties:
    * `name` (string): The name of the field. This is at the same time the key in the `data` properties of markers and lines
    * `oldName` (string): When renaming a field (using [`editType(data)`](#edittypedata)), specify the former name here
    * `type` (string): The type of field, one of `textarea`, `dropdown`, `checkbox`, `input`
    * `controlColour`, `controlSize`, `controlSymbol`, `controlWidth` (boolean): If this field is a dropdown, whether
      the different options set a specific property on the object
    * `default` (string/boolean): The default value of this field
    * `options` ([object]): If this field is a dropdown, an array of objects with the following properties:
        * `value` (string): The value of this option.
        * `oldValue` (string): When renaming a dropdown option (using [`editType(data)`](#edittypedata)), specify the
          former value here
        * `colour`, `size`, `symbol`, `width` (string/number): The property value if this field controls that property

### searchResult

* `short_name` (string): Short display name of the result
* `display_name` (string): Long display name of the result
* `boundingbox` ([bbox](#bbox)): bbox that has a good view onto the result. Might be null if `zoom` is set.
* `lat`, `lon` (number): Position of the search result.
* `zoom` (number): Zoom level at which there is a good view onto the result. Might be null if `boundingbox` is set.
* `extratags` (object): Extra OSM tags that might be useful
* `geojson` (object): GeoJSON if the result has a shape
* `icon` (string): Symbol key of the result
* `type` (string): Type of the result
* `id` (string): If the result is an OSM object, the ID of the OSM object, prefixed by `n` (node), `w` (way) or `r` (relation)
* `ele` (number): Elevation in meters

### route

* `routePoints` (array): Array of route points (objects with `lon` and `lat` properties)
* `mode` (string): Route mode: `"car"`, `"bicycle"`, `"pedestrian"` or an empty string `""` for a direct line
* `trackPoints` (array): An array of track points (objects with a `lon`, `lat`, `ele`, `idx` property and also a `zoom`
  property that indicates from which zoom level the track point should be shown (to avoid an unnecessarily high resolution))
* `distance` (number): The distance of the route in kilometers
* `time` (number): The time it takes to travel the route in seconds
* `ascent` (number): The total meters of climb
* `descent` (number) The total meters of drop
