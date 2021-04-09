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

The ID under which the client is connected to the map. Can be the read-only or a read-write ID of an existing map.

Note that the ID can be changed in the settings. If in case of a [`padData`](./events#paddata) event, the ID of the pad has
changed, this property is updated automatically.

_Type:_ string

## `readonly`

`true` if the map has been opened using its read-only ID. `false` if the map is writable.

_Type:_ boolean

## `writable`

`2` if the map has been opened using its admin ID, `1` if if has been opened using the writable ID, `0` if the map is read-only.

_Type:_ number


## `deleted`

`true` if the map was deleted while this client was connected to it.

## `padData`

The current settings of the map. `writeId` and/or `adminId` is null if if has been opened using another ID than the admin ID.

_Type:_ [padData](./types#paddata)

## `markers`

All markers that have been retrieved so far.

_Type:_ `{"<marker id>": `[`marker`](./types#marker)`}`

## `lines`

All lines and their track points that have been retrieved so far.

_Type:_ `{"<line id>": `[`line with trackPoints`](./types#line)`}`

## `views`

All views that have been retrieved so far.

_Type:_ `{"<view id>": `[`view`](./types#view)`}`

## `types`

All types that have been retrieved so far.

_Type:_ `{"<type id>": `[`type`](./types#type)`}`

## `history`

All history entries that have been retrieved so far. Note that you have to subscribe to the history using
[`listenToHistory()`](./methods#listentohistory).

_Type:_ `{"<entry id>": `[`historyEntry`](./types#historyentry)`}`

## `route`

Information about the temporary route set using [`setRoute()`](./methods#setroute-data).

_Type:_ [`route`](./types#route)


## `serverError`

If the opening the pad failed ([`setPadId(padId)`](./methods#setpadid-padid) promise got rejected), the error message is stored
in this property.

## `loading`

A number that indicates how many requests are currently pending. You can use this to show a loading spinner or disable certain
UI elements while the value is greater than 0.