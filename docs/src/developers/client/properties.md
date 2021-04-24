# Properties

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

## `padId`

The ID of the collaborative map that the client is connected to. Can be the read-only, writable or admin ID of an existing map.

Note that the ID can be changed in the settings. If in case of a [`padData`](./events.md#paddata) event, the ID of the pad has changed, this property is updated automatically.

_Set:_ when calling [`setPadId`](./methods.md#setpadid-padid) and in response to a [`padData`](./events.md#paddata) event.\
_Type:_ string

## `readonly`

`true` if the map has been opened using its read-only ID. `false` if the map is writable.

_Set:_ during [`setPadId`](./methods.md#setpadid-padid).\
_Type:_ boolean

## `writable`

`2` if the map has been opened using its admin ID, `1` if if has been opened using the writable ID, `0` if the map is read-only.

_Set:_ during [`setPadId`](./methods.md#setpadid-padid).\
_Type:_ number


## `deleted`

`true` if the map was deleted while this client was connected to it.

_Set:_ in response to a [`deletePad`](./events.md#deletepad) event.\
_Type:_ boolean

## `padData`

The current settings of the map. `writeId` and/or `adminId` is null if if has been opened using another ID than the admin ID.

_Set:_ in response to a [`padData`](./events.md#paddata) event.\
_Type:_ [PadData](./types.md#paddata)

## `markers`

All markers that have been retrieved so far.

_Set:_ in response to [`marker`](./events.md#marker) and [`deleteMarker`](./events.md#deletemarker) events.\
_Type:_ [<code>{ &#91;markerId: number&#93;: Marker }</code>](./types.md#marker)

## `lines`

All lines of the map along with the track points that have been retrieved so far.

_Set:_ in response to [`line`](./events.md#line), [`linePoints`](./events.md#linepoints) and [`deleteLine`](./events.md#deleteline) events.\
_Type:_ [<code>{ &#91;lineId: number&#93;: Line }</code>](./types.md#line) (with track points)

## `views`

All views of the map.

_Set:_ in response to [`view`](./events.md#view) and [`deleteView`](./events.md#deleteview) events.\
_Type:_ [<code>{ &#91;viewId: number&#93;: View }</code>](./types.md#view)

## `types`

All types of the map.

_Set:_ in response to [`type`](./events.md#type) and [`deleteType`](./events.md#deletetype) events.\
_Type:_ [<code>{ &#91;typeId: number&#93;: Type }</code>](./types.md#type)

## `history`

All history entries that have been retrieved so far. Note that you have to subscribe to the history using [`listenToHistory()`](./methods.md#listentohistory).

_Set:_ in response to [`history`](./events.md#history) events.\
_Type:_ [<code>{ &#91;entryId: number&#93;: HistoryEntry }</code>](./types.md#historyentry)

## `route`

Details and track points (simplified for the current bbox) for the active route set using [`setRoute()`](./methods.md#setroute-data) with `routeId` set to `undefined`, or `undefined` if no such route is active.

_Set:_ during [`setRoute()`](./methods.md#setroute-data) and in response to [`routePoints`](./events.md#routepoints) events.\
_Type:_ [`Route`](./types.md#route)

## `routes`

Details and track points (simplified for the current bbox) for the active routes set using [`setRoute()`](./methods.md#setroute-data) with `routeId` set to a string.

_Set:_ during [`setRoute()`](./methods.md#setroute-data) and in response to [`routePoints`](./events.md#routepoints) events.\
_Type:_ [<code>{ &#91;routeId: string&#93;: Route }</code>](./types.md#route)

## `serverError`

If the opening the map failed ([`setPadId(padId)`](./methods.md#setpadid-padid) promise got rejected), the error message is stored in this property.

_Set:_ in response to a [`serverError`](./events.md#servererror) event (fired during [`setPadId`](./methods.md#setpadid-padid)).\
_Type:_ Error

## `loading`

A number that indicates how many requests are currently pending (meaning how many async methods are currently running). You can use this to show a loading spinner or disable certain UI elements while the value is greater than 0.

_Set:_ increased when any method is called and decreased when the method returns.\
_Type:_ `number`

## `disconnected`

`false` in the beginning, changed to `true` as soon as the socket.io connection is made. May be `false` temporarily if the connection is lost.

_Set:_ in reaction to `connect` and `disconnect` events.\
_Type:_ `boolean`