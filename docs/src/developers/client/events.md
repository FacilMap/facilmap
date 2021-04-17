# Events

The FacilMap server uses events to send information about objects on a collaborative map to the client. The events are fired when the client opens a map or a particular section of a map for the first time, and whenever an object is changed on the map (including when the change is made by the same instance of the client). The client has some listeners already attached to most events and uses them to persist and update the received objects in its [properties](./properties).

Note that events are always fired _before_ the method causing them returns. For example, when updating a marker using the `editMarker()` method, a `marker` event with the updated marker is fired first (if the marker is within the current bbox), and only then the method returns the updated marker as well.

Subscribe to events using the [`on(eventName, function)`](./methods#on-eventname-function) method. Example:

```js
const client = new FacilMap.Client("https://facilmap.org/", "testPad");
client.on("padData", (padData) => {
	document.title = padData.name;
});
```

## `connect`, `disconnect`, `connect_error`, `error`, `reconnect`, `reconnect_attempt`, `reconnect_error`, `reconnect_failed`

These events come from socket.io and are [documented there under the section “Events”](http://socket.io/docs/client-api/).

## `padData`

The settings of the map have changed or are retrieved for the first time.

Note that when this event is fired, the read-only and/or the read-write ID of the map might have changed. The [`padId`](./properties#padid)
property is updated automatically.

_Type:_ [PadData](./types#paddata)

## `serverError`

[`setPadId()`](./methods#setpadid-padid) failed and the map could not be opened.

_Type:_ Error

## `deletePad`

The map has been deleted.

## `marker`

An existing marker is retrieved for the first time, has been modified, or a new marker has been created in the current bbox.

_Type:_ [Marker](./types#marker)

## `deleteMarker`

A marker has been removed. This event is emitted for all markers on the map, even if they are outside of the current bbox
(in case that a marker outside of the current bbox is cached).

_Type:_ `{ id: number }`

## `line`

An existing line is retrieved for the first time, has been modified, or a new line has been created. Note that line
objects only contain the line metadata, not its track points (those are handled separately as `linePoints`). This is why
all line objects of the map are sent to the client, regardless of the current bbox.

_Type:_ [Line](./types#line) (without trackPoints)

## `deleteLine`

A line has been removed.

_Type:_ `{ id: number }`

## `linePoints`

New track points for an existing line are retrieved after a change of bbox (`reset == false`), or the line has been
modified, so the new track points are retrieved (`reset == true`).

_Type:_ object with the following properties:
* __id__ (number): The ID of the line that these track points belong to
* __reset__ (boolean): Whether to remove all cached track points for this line (`true`) or to merge these track points
  with the cached ones (`false`).
* __trackPoints__ (Array<[TrackPoint](./types#trackpoint)>): The track points

## `view`

A view is retrieved for the first time, has been modified, or a new view has been created.

_Type:_ [View](./types#view)

## `deleteView`

A view has been removed.

_Type:_ `{ id: number }`

## `type`

A type is retrieved for the first time, has been modified, or a new type has been created.

_Type:_ [Type](./types#type)

## `deleteType`

A type has been removed.

_Type:_ `{ id: number }`

## `history`

An entry of the modification history is retrieved for the first time, or a new entry has been created due to something
being modified. Note that this event is only fired when the client has subscribed using [`listenToHistory()`](./methods#listentohistory).
 
_Type:_ [historyEntry](./types#historyentry)

## `route`

A new route has been set.

_Type:_ [Route](./types#route)> with trackpoints for the current bbox. The `routeId` property identifies the route (can be a string or undefined).

## `clearRoute`

A route has been cleared.

_Type:_ `{ routeId: string | undefined }`

## `routePoints`

New track points for the default route (route that has been set using [`setRoute()`](./methods#setroute-data) without a `routeId`) are retrieved after a change of bbox.

_Type:_ Array<[TrackPoint](./types#trackpoint)>

## `routePointsWithId`

New track points for a route with a `routeId` are retrieved after a change of bbox.

_Type:_ object with the following properties:
* **routeId** (string): The `routeId` that was passed when setting the route using [`setRoute()`](./methods#setroute-data)
* **trackPoints** (`Array<[trackPoint](./types#trackpoint)>`): The additional track points for the route
 
## `loadStart`, `loadEnd`

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

## `emit`, `emitResolve`, `emitReject`

`emit` is emitted by the client whenever any request is sent to the server, and `emitResolve` or `emitReject` is emitted when the request is answered. These can be used to hook into the communication between the client and the server. All 3 events are called with two arguments, the first one being the request name and the second one being the request data, response data or error.