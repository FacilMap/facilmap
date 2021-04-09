# Methods

## `constructor(server, padId)`

Connects to the FacilMap server `server` and optionally opens the collaborative map with the ID `padId`. If the pad ID
is not set, it can be set later using [`setPadId(padId)`](#setpadid-padid) or using [`createPad(data)`](#createpad-data).

Setting the padId causes the server to send several objects, such as the map settings, all views, all types, and all
lines (just meta data, without line points).

If the connection to the server breaks down, a `disconnect` event will be emitted and socket.io will attempt to reconnect.
On successful reconnection, a `reconnect` and `connect` event will be fired.

* `server` (string): The URL of the FacilMap server, for example `https://facilmap.org/`
* `padId` (string, optional): The ID of the collaborative map to open

## `on(eventName, function)`

Registers a new [event](./events) handler.

* `eventName` (string): The name of the event
* `function` (function): The function that should be executed when the event occurs. If the event emits an object,
  it will be passed to the function as the first parameter.

## `removeListener(eventName, function)`

Unregisters an event handler previously assigned using `on(eventName, function)`.

* `eventName` (string): The name of the event
* `function` (function): The function that was passed to `on(eventName, function)` when registering the handler

## `setPadId(padId)`

Opens the collaborative map with the ID `padId`.

This method can only be called once, and only if no `padId` has been passed to the constructor. If you want to open
a different map, you need to create a new instance of the client.

Setting the padId causes the server to send several objects, such as the map settings, all views, and all lines (just
meta data, without line points).

* `padId` (string): The ID of the collaborative map to open
* _returns_ (Promise): A promise that resolves when all objects have been received.

## `updateBbox(bbox)`

Updates the bbox. This will cause all markers and line points within the bbox (except the ones that were already in the
previous bbox, if there was one) to be received.

* __bbox__ ([bbox](./types#bbox) with zoom): The bbox that objects should be received for
* _returns_ (Promise): A promise that resolves when all objects have been received.

## `createPad(data)`

Creates a new collaborative map.

* `data` ([padData](./types#paddata)): The data of the new map, including the desired read-only and writable ID
* _returns_ (Promise): A promise that resolves when the map has been created, returning the new padData.

## `editPad(data)`

Update the metadata of the current map.

* `data` ([padData](./types#paddata)): The data of the map that should be modified. Fields that are not defined will not be
  modified. To change the default view, set the `defaultViewId` property. The `defaultView` property is ignored.
* _returns_ (Promise): The new padData.

## `deletePad()`

Delete the current map irrevocably.

* _returns_ (Promise): An empty promise that resolves when the map has been deleted.

## `listenToHistory()`

Start listening to the modification history of the map. Calling this will cause multiple `history` objects to be
received (that describe the modification history until now), and new `history` objects will be received every time
something is modified (in addition to the modified object).

* _returns_ (Promise): A promise that resolves when all history objects have been received

## `stopListeningToHistory()`

Stop listening to the modification history of the map.

* _returns_ (Promise): A promise that resolves when the command has completed.

## `revertHistoryEntry(data)`

Undo a modification in the map. When a previously removed object is restored, it receives a new ID, and thus the object
IDs of all other history entries connected to this object are updated as well. This is why reverting a history entry
will cause the whole history to be received again (as if you were calling `listenToHistory()` again).

* `data` (`{id: "<historyEntryId>"}`)): The history object that should be reverted
* _returns_ (Promise): A promise that resolves when the command has completed and all new history objects have been received

## `disconnect()`

Empties all cached objects and disconnects from the server.

## `find(data)`

Search for places.

* `data` (object): An object with the following properties:
    * `query` (string): The query string
    * `loadUrls` (boolean): Whether to return the file if `query` is a URL
    * `elevation` (boolean): Whether to find out the elevation of the result(s). Will make the search significantly slower.
* _returns_ (Promise<string|Array<[searchResult](./types#searchresult)>>): If `data.query` is a URL to a GPX/KML/OSM/GeoJSON
  file, that file as a string, otherwise an array of search results.

## `findOnMap(data)`

Search for markers and lines inside the map.

* `data` (object): An object with the following properties:
	* `query` (string): The query string
* _returns_ (Promise<Array<[Marker](./types#marker)|[Line](./types#line)>>) An array of (stripped down) marker and line objects.
  The objects only contain the `id`, `name`, `typeId`, `lat`/`lon` (for markers), `left`/`top`/`right`/`bottom` (for
  lines) properties, plus an additional `kind` property that is either `"marker"` or `"line"`.

## `getRoute(data)`

Calculate a route between two or more points.

* `data` (object): An object with the following properties:
    * `destinations` (array): An array of at least two route points (objects with a `lat` and `lon` property)
    * `mode` (string): `"car"`, `"bicycle"` or `"pedestrian"`
* _returns_ (Promise<[route](./types#route)>)

## `setRoute(data)`

Calculate a route between two or more points, but but do not return the track points of the route but cache them on the
server side and send them according to the client bbox. The properties of the route are saved in the [`route`](./properties#route)
property and the trackPoints in `route.trackPoints`. Only one temporary route like this can be set at a time, when
calling `setRoute()` again, the existing route will be modified.

* `data` (object): An object with the following properties:
    * `routePoints` (array): An array of at least two route points (objects with a `lat` and `lon` property)
    * `mode` (string): `"car"`, `"bicycle"` or `"pedestrian"`
    * `elevation` (boolean): `true` to get elevation data for the route
* _returns_ (Promise<[route](./types#route)>)

## `clearRoute()`

Clear the temporary route set via [`setRoute(data)`](#setroute-data).

* _returns_ (Promise)

## `lineToRoute(data)`

Call [`setRoute()`](#setroute-data) with the parameters of an existing line. Saves time, as the route does not need to be
recalculated.

* `data` (object): An object with the following properties:
	* `id` (string): The ID of the line
* _returns_ (Promise<[route](./types#route)>)

## `exportRoute(data)`

Export the current route.

* `data` (object): An object with the following properties:
	* `format` (string): One of the following:
		* `gpx-trk`: GPX track (contains the whole course of the route)
		* `gpx-rte`: GPX route (contains only the route points, and the navigation device will have to calculate the route)
* _returns_ (Promise&lt;string&gt;)

## `getMarker(data)`

Get the marker with the given ID.

* `data` (object): An object with the following properties:
    * `id` (number): The ID of the marker to load
* _returns_ (Promise<[marker](./types#marker)>): The marker

## `addMarker(data)`

Create a marker.

* `data` ([marker](./types#marker)): The data of the marker to create. An `id` will be assigned by the server
* _returns_ (Promise<[marker](./types#marker)>): The marker as it is on the server, with an `id` assigned and possibly its
  styles modified by the settings of its type.

## `editMarker(data)`

Update an existing marker.

* `data` ([marker](./types#marker)). The new marker data. Fields that are not defined will not be unmodified. Only `id` needs
  to be defined.
* _returns_ (Promise<[marker](./types#marker)>): The new marker. Might have some styles modified due to the settings of its type

## `deleteMarker(data)`

Delete an existing marker

* `data` (`{id: <markerId>}`): An object that contains the ID of the marker to be removed
* _returns_ (Promise): A promise that resolves when the operation has completed

## `getLineTemplate(data)`
 
Get a fake line object for a line with the given type. This can be used so that while the user is drawing a new line,
that line already has the right style.

* `data` (`{typeId: <typeId>}`): An object containing the type ID
* _returns_ (Promise<[line](./types#line)>): A fake line object with the styles of this type

## `addLine(data)`

Create a line.

* `data` ([line](./types#line)): The data of the line to create. An `id` will be assigned by the server
* _returns_ (Promise<[line](./types#line)>): The line as it is on the server, with an `id` assigned and possibly its
  styles modified by the settings of its type.

## `editLine(data)`

Update an existing line.

* `data` ([line](./types#line)). The new line data. Fields that are not defined will not be unmodified. Only `id` needs
  to be defined.
* _returns_ (Promise<[line](./types#line)>): The new line. Might have some styles modified due to the settings of its type

## `deleteLine(data)`

Delete an existing line

* `data` (`{id: <lineId>}`): An object that contains the ID of the line to be removed
* _returns_ (Promise): A promise that resolves when the operation has completed

## `exportLine(data)`

Export a line.

* `data` (object): An object with the following properties:
	* `id` (string): The ID of the line
	* `format` (string): One of the following:
		* `gpx-trk`: GPX track (contains the whole course of the route)
		* `gpx-rte`: GPX route (contains only the route points, and the navigation device will have to calculate the route)
* _returns_ (Promise&lt;string&gt;)

## `addType(data)`

Create a type.

* `data` ([type](./types#type)): The data of the type to create. An `id` will be assigned by the server
* _returns_ (Promise<[type](./types#type)>): The type as it is on the server, with an `id` assigned.

## `editType(data)`

Update an existing type.

* `data` ([type](./types#type)). The new type data. Fields that are not defined will not be unmodified. Only `id` needs
  to be defined.
  To rename a field, set the `oldName` property of the field object to the previous name and the `name` property to the
  new name. To rename a dropdown entry, set the `oldValue` property to the old value and the `value` property to the new
  value.
* _returns_ (Promise<[type](./types#type)>): The new type.

## `deleteType(data)`

Delete an existing type

* `data` (`{id: <typeId>}`): An object that contains the ID of the type to be removed
* _returns_ (Promise): A promise that resolves when the operation has completed

## `addView(data)`

Create a view.

* `data` ([view](./types#view)): The data of the view to create. An `id` will be assigned by the server
* _returns_ (Promise<[view](./types#view)>): The view as it is on the server, with an `id` assigned.

## `editView(data)`

Update an existing view.

* `data` ([view](./types#view)). The new view data. Fields that are not defined will not be unmodified. Only `id` needs
  to be defined.
* _returns_ (Promise<[view](./types#view)>): The new view.

## `deleteView(data)`

Delete an existing view

* `data` (`{id: <viewId>}`): An object that contains the ID of the view to be removed
* _returns_ (Promise): A promise that resolves when the operation has completed

## `geoip()`

Returns an approximate location for the IP address of the client.

* _returns_ (Promise<{top,right,bottom,left}>) A promise that resolves to a bounding box that includes the location of
  the client