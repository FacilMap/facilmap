# Methods

## `constructor(server, padId)`

Connects to the FacilMap server `server` and optionally opens the collaborative map with the ID `padId`. If the pad ID
is not set, it can be set later using [`setPadId(padId)`](#setpadid-padid) or using [`createPad(data)`](#createpad-data).

The connection is established in the background, and a `connect` event is fired when it is successful. If a `padId` is specified, a [`padData`](./events#paddata) or [`serverError`](./events#servererror) event will indicate when the map has been opened successfully or unsuccessfully. Note that you can already call methods immediately after constructing the client, causing them to be delayed until the connection is established.

If the connection to the server breaks down, a `disconnect` event will be emitted and socket.io will attempt to reconnect. On successful reconnection, a `reconnect` and `connect` event will be fired. During the interruption, you can still call methods, causing them to be delayed until the connection is reestablished.

* `server` (string): The URL of the FacilMap server, for example `https://facilmap.org/`.
* `padId` (string, optional): The ID of the collaborative map to open.
* **Events:** Causes a `connect` event to be fired when the connection is established. If `padId` is defined, causes events to be fired with the map settings, all views, all types and all lines (without line points) of the map. If the map with `padId` could not be opened, causes a [`serverError`](./events#servererror) event.

## `on(eventName, function)`

Registers a new [event](./events) handler.

* `eventName` (string): The name of the event.
* `function` (function): The function that should be executed when the event occurs. If the event emits an object, it will be passed to the function as the first parameter.

## `removeListener(eventName, function)`

Unregisters an event handler previously assigned using `on(eventName, function)`.

* `eventName` (string): The name of the event.
* `function` (function): The function that was passed to `on(eventName, function)` when registering the handler.

## `setPadId(padId)`

Opens the collaborative map with the ID `padId`.

This method can only be called once, and only if no `padId` was passed to the constructor. If you want to open a different map, you need to create a new instance of the client.

Setting the padId causes the server to send several objects, such as the map settings, all views, and all lines (just metadata, without line points). Each of these objects is sent as an individual [`event`](./events).

* `padId` (string): The ID of the collaborative map to open. Can be a read-only ID, writable ID or admin ID of a map.
* **Returns:** A promise that is resolved empty when all objects have been received.
* **Events:** Causes events to be fired with the map settings, all views, all types and all lines (without line points) of the map. If the map could not be opened, causes a [`serverError`](./events#servererror) event.
* **Availability:** Only available if no map is opened yet on this client instance.

## `updateBbox(bbox)`

Updates the bbox. This will cause all markers, line points and route points within the bbox (except the ones that were already in the previous bbox, if there was one) to be received as individual events.

* __bbox__ ([Bbox](./types#bbox) with zoom): The bbox that objects should be received for.
* **Returns:** A promise that is resolved empty when all objects have been received.
* **Events:** Causes events to be fired with the markers, line points and route points within the bbox.
* **Availability:** Always.

## `createPad(data)`

Creates a new collaborative map and opens it.

* `data` ([padData](./types#paddata)): The data of the new map, including the desired read-only, writable and admin ID.
* **Returns:** A promise that is resolved with the new padData when the map has been created.
* **Events:** Causes a [`padData`](./events#paddata) event and other events for objects that have been created on the map (such as the default Marker and Line types).
* **Availability:** Only if no collaborative map is opened yet.

## `editPad(data)`

Update the map settings of the current map.

* `data` ([PadData](./types#paddata)): The data of the map that should be modified. Fields that are not defined will not be modified. To change the default view, set the `defaultViewId` property. The `defaultView` property is ignored.
* **Returns:** A promise that is resolved with the new padData.
* **Events:** Causes a [`padData`](./events#paddata) event.
* **Availability:** Only if a collaborative map is opened through its admin ID.

## `deletePad()`

Delete the current map irrevocably.

* **Returns:** A promise that is resolved empty when the map has been deleted.
* **Events:** Causes a [`deletePad`](./events#deletepad) event.
* **Availability:** Only if a collaborative map is opened through its admin ID.

## `listenToHistory()`

Start listening to the modification history of the map. Calling this will cause multiple `history` objects to be
received (that describe the modification history until now), and new `history` objects will be received every time
something is modified (in addition to the modified object).

* **Returns:** A promise that is resolved empty when all history objects have been received.
* **Events:** Causes multiple [`history`](./events#history) events.
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
* **Events:** Causes multiple [`history`](./events#history) events and an event that reverts the change.
* **Availability:** Only if a collaborative map is opened through its admin ID.

## `disconnect()`

Empties all cached objects and disconnects from the server.

## `find(data)`

Search for places. Does not persist anything on the server, simply serves as a proxy to the search service.

* `data` (object): An object with the following properties:
    * `query` (string): The query string
    * `loadUrls` (boolean): Whether to return the file if `query` is a URL
    * `elevation` (boolean): Whether to find out the elevation of the result(s). Will make the search significantly slower.
* **Returns:** A promise that is resolved with the following value:
	* If `data.query` is a URL to a GPX/KML/OSM/GeoJSON file and `loadUrls` is `true`, a string with the content of the file.
	* Otherwise an array of [SearchResults](./types#searchresult).
* **Events:** None.
* **Availability:** Always.

## `findOnMap(data)`

Search for markers and lines inside the map.

* `data` (object): An object with the following properties:
	* `query` (string): The query string
* **Returns:** A promise that is resolved with an array of (stripped down) [Marker](./types#marker) and [Line](./types#line) objects. The objects only contain the `id`, `name`, `typeId`, `lat`/`lon` (for markers), `left`/`top`/`right`/`bottom` (for lines) properties, plus an additional `kind` property that is either `"marker"` or `"line"`.
* **Events:** None.
* **Availability:** Only when a map is opened.

## `getRoute(data)`

Calculate a route between two or more points. Does not persist anything on the server, simply serves as a proxy to the routing service.

* `data` (object): An object with the following properties:
	* `destinations` (array): An array of at least two route points (objects with a `lat` and `lon` property)
	* `mode` ([RouteMode](./types#routemode)): the route mode
* **Returns:** A promise that is resolved with a [Route](./types#route)>.
* **Events:** None.
* **Availability:** Always.

## `setRoute(data)`

Calculate a route between two or more points, but but do not return the track points of the route but cache them on the server side and send them according to the client bbox. The route is not persisted on a collaborative map, but is temporarily persisted on the server in the scope one particular client connection only. As long as the route is active, the server will send [`routePoints`](./events#routepoints) events in response to [`updateBbox()`](#updatebbox-bbox) with the track points of the route simplified according to the bbox. The route will stay active until it is cleared using [`clearRoute()`](#clearroute-data) or the connection is closed.

Multiple routes can be active at the same time. They can be distinguished by their `routeId` property, which is a custom string that you can specify when activating a route. A `routeId` needs to be unique in the scope of this client instance, other clients are not affected by it. For backwards compatibility reasons, `undefined` is an acceptable value for `routeId`, but is considered a unique identifier nonetheless.

Calling `setRoute()` with a `routeId` of a route that is already active will replace that route.

The metadata of a route whose `routeId` is `undefined` is persisted in the [`route`](./properties#route) property and its track points in `route.trackPoints`. The metadata of a route whose `routeId` is a string is persisted in the [`routes[routeId]`](./properties#routes) property and its track points in `routes[routeId].trackPoints`.

* `data` (object): An object with the following properties:
    * `routePoints` (array): An array of at least two route points (objects with a `lat` and `lon` property)
    * `mode` ([RouteMode](./types#routemode)): the route mode
	* `routeId` (string or undefined): the custom `routeId` to identify the route
* **Returns:** A promise that is resolved with a [Route](./types#route)> object.
* **Events:** Causes a [`route`](./events#route) and a [`routePoints`](./events#routepoints) event.
* **Availability:** Always.

## `clearRoute(data)`

Clear a temporary route set via [`setRoute(data)`](#setroute-data).

* `data` (object): An object with the following properties:
	* `routeId` (string or undefined): the custom `routeId` to identify the route
* **Returns:** A promise that is resolved empty when the route is cleared.
* **Events:** Causes a [`clearRoute`](./events#clearroute) event.
* **Availability:** If a route with the specified `routeId` is active.

## `lineToRoute(data)`

Call [`setRoute()`](#setroute-data) with the parameters of an existing line. Saves time, as the route does not need to be recalculated. If a route with the same `routeId` is already active, it is replaced.

* `data` (object): An object with the following properties:
	* `id` (string): The ID of the line
	* `routeId` (string or undefined): the custom `routeId` to identify the route
* **Returns:** A promise that is resolved with a [Route](./types#route)> object.
* **Events:** Causes a [`route`](./events#route) and a [`routePoints`](./events#routepoints) event.
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
* **Returns:** A promise that is resolved with a [Marker](./types#marker)>. If the marker is not found, the promise rejects.
* **Events:** None.
* **Availability:** Only if a collaborative map is opened.

## `addMarker(data)`

Create a marker.

* `data` ([Marker](./types#marker)): The data of the marker to create. An `id` will be assigned by the server.
* **Returns:** A promise that is resolved with a [Marker](./types#marker)>, with an `id` assigned and possibly its styles modified by the settings of its type.
* **Events:** May trigger a [`marker`](./events#marker) event if the created marker is in the current bbox.
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `editMarker(data)`

Update an existing marker.

* `data` ([Marker](./types#marker)). The new marker data. Fields that are not defined will not be unmodified. Only `id` needs to be defined.
* **Returns:** A promise that is resolved with the updated [Marker](./types#marker). Might have some styles modified due to the settings of its type.
* **Events:** May trigger a [`marker`](./events#marker) event if the updated marker is in the current bbox.
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `deleteMarker(data)`

Delete an existing marker

* `data` (`{ id: number }`): an object that contains the ID of the marker to be removed
* **Returns:** An promise that is resolved with the deleted [Marker](./types#marker) when the operation has completed.
* **Events:** Causes a [`deleteMarker`](./events#deletemarker) event.
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `getLineTemplate(data)`
 
Get a mock line object for a line with the given type. This can be used so that while the user is drawing a new line,
that line already has the right style.

* `data` (`{ typeId: number }`): An object containing the type ID
* **Returns:** A promise that is resolved with a mock [Line](./types#line) with the styles of this type.
* **Events:** None.
* **Availability:** Only if a collaborative map is opened.

## `addLine(data)`

Create a line.

* `data` ([Line](./types#line)): The data of the line to create. An `id` will be assigned by the server.
* **Returns:** A promise that is resolved with a [Line](./types#line), with an `id` assigned and possibly its styles modified by the settings of its type.
* **Events:** Causes a [`line`](./events#line) event and a [`linePoints`](./events#linepoints) event (if the line is in the current bbox).
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `editLine(data)`

Update an existing line.

* `data` ([line](./types#line)). The new line data. Fields that are not defined will not be unmodified. Only `id` needs to be defined.
* **Returns:** A promise that is resolved with the update [Line](./types#line). Might have some styles modified due to the settings of its type.
* **Events:** Causes a [`line`](./events#line) event and possibly a [`linePoints`](./events#linepoints) event (if the route mode was changed and the line is in the current bbox).
* **Availability:** Only if a collaborative map is opened using its writable or admin ID.

## `deleteLine(data)`

Delete an existing line

* `data` (`{id: <lineId>}`): An object that contains the ID of the line to be removed
* **Returns:** A promise that is resolved with the deleted [Line](./types#line) when the operation has completed.
* **Events:** Causes a [`deleteLine`](./events#deleteline) event.
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

* `data` ([Type](./types#type)): The data of the type to create. An `id` will be assigned by the server.
* **Returns:** A promise that is resolved with the created [Type](./types#type)>, with an `id` assigned.
* **Events:** Causes a [`type`](./events#type) event.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `editType(data)`

Update an existing type.

* `data` ([type](./types#type)). The new type data. Fields that are not defined will not be unmodified. Only `id` needs to be defined. To rename a field, set the `oldName` property of the field object to the previous name and the `name` property to the new name. To rename a dropdown entry, set the `oldValue` property to the old value and the `value` property to the new value.
* **Returns:** A promise that is resolved with the updated <[Type](./types#type)>.
* **Events:** Causes a [`type`](./events#type) event. If the update causes the styles of existing markers or lines to change, events for those are triggered as well.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `deleteType(data)`

Delete an existing type

* `data` (`{id: <typeId>}`): An object that contains the ID of the type to be removed
* **Returns:** A promise that is resolved with the deleted [Type](./types#type) when the operation has completed. If there are any objects on the map that still use this type, the promise rejects.
* **Events:** Causes a [`deleteType`](./events#deletetype) event.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `addView(data)`

Create a view.

* `data` ([view](./types#view)): The data of the view to create. An `id` will be assigned by the server
* **Returns:** A promise that is resolved with the created <[View](./types#view)>), with an `id` assigned.
* **Events:** Causes a [`view`](./events#view) event.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `editView(data)`

Update an existing view.

* `data` ([view](./types#view)). The new view data. Fields that are not defined will not be unmodified. Only `id` needs to be defined.
* **Returns:** A promise that is resolved with the updated <[View](./types#view)>).
* **Events:** Causes a [`view`](./events#view) event.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `deleteView(data)`

Delete an existing view

* `data` (`{id: <viewId>}`): An object that contains the ID of the view to be removed
* **Returns:** A promise that is resolved when the operation has completed.
* **Events:** Causes a [`deleteView`](./events#deleteview) event.
* **Availability:** Only if a collaborative map is opened using its admin link.

## `geoip()`

Returns an approximate location for the IP address of the client.

* **Returns:** A promise that is resolved to a [bounding box](./types#bbox) (without zoom) that includes the location of the client. If no location can be determined, the promise is resolved with `undefined`.
* **Events:** None.
* **Availability:** Always.