# Events

Subscribe to events using the [`on(eventName, function)`](./methods#on-eventname-function) method. Example:

```js
let client = new FacilMap.Client("https://facilmap.org/", "testPad");
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

_Type:_ [padData](./types#paddata)

## `deletePad`

The map has been deleted.

## `marker`

An existing marker is retrieved for the first time, has been modified, or a new marker has been created in the current bbox.

_Type:_ [marker](./types#marker)

## `deleteMarker`

A marker has been removed. This event is emitted for all markers in the map, even if they are outside of the current bbox
(in case that a marker outside of the current bbox is cached).

_Type:_ `{id: "<markerId>"}`

## `line`

An existing line is retrieved for the first time, has been modified, or a new line has been created. Note that line
objects only contain the line metadata, not its track points (those are handled separately as `linePoints`). This is why
all line objects of the map are sent to the client, regardless of the current bbox.

_Type:_ [line without trackPoints](./types#line)

## `deleteLine`

A line has been removed.

_Type:_ `{id: "<lineId>"}`

## `linePoints`

New track points for an existing line are retrieved after a change of bbox (`reset == false`), or the line has been
modified, so the new track points are retrieved (`reset == true`).

_Type:_ {
* __id__ (number): The ID of the line that these track points belong to
* __reset__ (boolean): Whether to remove all cached track points for this line (`true`) or to merge these track points
  with the cached ones (`false`).
* __trackPoints__ (Array<[trackPoint](./types#trackpoint)>): The track points

}

## `view`

A view is retrieved for the first time, has been modified, or a new view has been created.

_Type:_ [view](./types#view)

## `deleteView`

A view has been removed.

_Type:_ `{id: "<viewId>"}`

## `type`

A type is retrieved for the first time, has been modified, or a new type has been created.

_Type:_ [type](./types#type)

## `deleteType`

A type has been removed.

_Type:_ `{id: "<typeId>"}`

## `history`

An entry of the modification history is retrieved for the first time, or a new entry has been created due to something
being modified. Note that this event is only fired when the client has subscribed using [`listenToHistory()`](./methods#listentohistory).
 
 _Type:_ [historyEntry](./types#historyentry)
 
## `routePoints`

New track points for the temporary route are retrieved after a change of bbox.

_Type:_ Array<[trackPoint](./types#trackpoint)>
 
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