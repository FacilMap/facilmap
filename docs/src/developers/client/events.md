# Socket events

The Socket API uses events to send information about objects on a collaborative map to the client. The events are fired when the client opens a map or a particular section of a map for the first time, and whenever an object is changed on the map (including when the change is made by the same instance of the client).

Note that events are always fired _before_ the method causing them returns. For example, when updating a marker using the `updateMarker()` method, a `marker` event with the updated marker is fired first (if the marker is within the current bbox), and only then the method returns the updated marker as well.

Subscribe to events using the [`on()`](./classes.md#on) method. When using raw Socket.IO, you can also use its [`on()`](https://socket.io/docs/v4/client-api/#socketoneventname-callback) method.

```js
const client = new SocketClient("https://facilmap.org/");
client.on("mapData", (mapSlug, mapData) => {
	if (mapSlug === "mymap") {
		document.title = mapData.name;
	}
});
client.subscribeToMap("mymap");
```

## `mapData`

Parameters: `mapSlug: string, mapData: MapDataWithWritable` (see [`MapDataWithWritable`](./types.md#mapdatawithwritable))

The settings of a subscribed map have changed or are retrieved for the first time.

Note that when this event is fired, the map slug might change.

## `mapSlugRename`

Parameters: `mapSlugs: Record<string, string>`

If one or more map slugs of a map are changed, this event is emitted in addition to the `mapData` event for your convenience. It is also emitted if you have not subscribed to `mapData` events. The `mapSlugs` object maps maps the old slug(s) to the new slug(s). You can use this to update the map slug of your subscription if you have it documented anywhere. The `mapSlugRename` event marks the exact point in time when the slug is changed – all events related to the map emitted before it use the old slug, and all events after use the new slug.

## `deleteMap`

Parameters: `mapSlug: string`

A subscribed map has been deleted.

## `marker`

Parameters: `mapSlug: string, marker: Marker` (see [Marker](./types.md#marker))

An existing marker is retrieved for the first time, has been modified, or a new marker has been created in the current bbox.

## `deleteMarker`

Parameters: `mapSlug: string, marker: { id: number }`

A marker has been removed. This event is emitted for all markers on the map, even if they are outside of the current bbox
(in case that a marker outside of the current bbox is cached).

## `line`

Parameters: `mapSlug: string, line: Line` (see [Line](./types.md#line))

An existing line is retrieved for the first time, has been modified, or a new line has been created. Note that line
objects only contain the line metadata, not its track points (those are handled separately as `linePoints`). This is why
all line objects of the map are sent to the client, regardless of the current bbox.

## `deleteLine`

Parameters: `mapSlug: string, line: { id: number }`

A line has been removed.

## `linePoints`

Parameters: `mapSlug: string, data: { lineId: number; trackPoints: TrackPoint[]; reset: boolean }` (see [TrackPoint](./types.md#trackpoint))

New track points for an existing line are retrieved after a change of bbox (`reset` is `false`, retrieved track points should be merged with existing ones), or the line has been modified, so the new track points are retrieved (`reset` is `true`, existing track points should be discarded).

## `view`

Parameters: `mapSlug: string, view: View` (see [View](./types.md#view))

A view is retrieved for the first time, has been modified, or a new view has been created.

## `deleteView`

Parameters: `mapSlug: string, view: { id: number }`

A view has been removed.

## `type`

Parameters: `mapSlug: string, type: Type` (see [Type](./types.md#type))

A type is retrieved for the first time, has been modified, or a new type has been created.

## `deleteType`

Parameters: `mapSlug: string, type: { id: number }`

A type has been removed.

## `history`

Parameters: `mapSlug: string, historyEntry: HistoryEntry` (see [HistoryEntry](./types.md#historyentry))

An entry of the modification history is retrieved for the first time, or a new entry has been created due to something being modified. Note that this event is only fired when the client has explicitly subscribed to the history in [`subscribeToMap()`](./methods.md#subscribetomap).

## `route`

Parameters: `routeKey: string, route: Route` (see [Route](./types.md#route))

A new route has been calculated. This event contains the metadata of the route, such as the distance and travel time.

## `routePoints`

Parameters: `routeKey: string, data: { trackPoints: TrackPoint[]; reset: boolean }` (see [TrackPoint](./types.md#trackpoint))

New track points for an existing line are retrieved after a change of bbox (`reset` is `false`, retrieved track points should be merged with existing ones), or the line has been
modified, so the new track points are retrieved (`reset` is `true`, existing track points should be discarded).

New track points for a subscribed route are retrieved after a change of bbox (`reset` is `false`, retrieved track points should be merge with existing ones) or after the route parameters have been modified or the route created (`reset` is `true`, existing track points should be discarded).

## `streamChunks`, `streamDone`, `streamError`

These are used internally for transmitting streams over the socket. When using the socket client, you don’t need to worry about them. When using raw Socket.IO, find the details in the chapter about [streams](./advanced.md#streams).