# Overview

The FacilMap client makes a connection to the FacilMap server using [socket.io](http://socket.io/). The client serves multiple purposes:
* Proxy to third-party services (find, route and geoip)
* Open a specific collaborative map and receive the objects on it
* Modify the objects on a collaborative map (only if opened through its writable or admin ID)
* Be notified live about changes that other people are making to the collaborative map.

The socket on the server side maintains different API versions in an attempt to stay backwards compatible with older versions of the client. Have a look at the [./changelog.md](changelog) to find out what has changed when upgrading to a new version of the client.


## Setting it up

Install facilmap-client as a dependency using npm or yarn:

```bash
npm install -S facilmap-client
```

or import the client from a CDN (only recommended for test purposes):

```html
<script type="module">
	import Client from "https://esm.sh/facilmap-client";
</script>
```


## TypeScript

facilmap-client is fully typed using [TypeScript](https://www.typescriptlang.org/). While facilmap-client can be used in a plain JavaScript app without problems, it is strongly suggested to use TypeScript, as it greatly helps to understand the data types of events, methods and properties and to avoid errors.


## Usage

One instance of the client class represents one connection to one specific collaborative map on one specific FacilMap server. The client instance knows different states:

* No map ID set: Only the find, route and geoip methods are available.
* No map ID set and bbox set: Simplified versions of the track points of active routes are sent according to the bbox.
* Map ID set: All methods are available. Events are received when the map settings, types, views and lines (only metadata, not track points) are created/updated/deleted.
* Map ID and bbox set: All methods are available. In addition to the other events, events are received when markers and lines in the specified bounding box are created/updated/deleted.

It is possible to initialize a client without a map ID and later open a map using [`setMapId`](./methods.md#setmapid-mapid) or [`createMap`](./methods.md#createmap-data). Once a specific map is loaded, it is not possible to close it or switch to another map anymore. To do that, a new client instance has to be created.

The bbox can be updated continuously. In the official FacilMap UI, the bbox is updated every time the user pans the map, causing the server to send the markers within that bbox and a simplified version of the line track points and active routes fit to the bbox and zoom level.

### Open a map

```js
import Client from "facilmap-client";

const client = new Client("https://facilmap.org/");
await client.setMapId("myMapId");
console.log(client.mapData, client.types, client.lines);
```

The client [constructor](./methods.md#constructor-server-mapid) takes the URL where the FacilMap server is running and opens a socket.io connection to the server.

When opening a collaborative map using [`setMapId`](./methods.md#setmapid-mapid), the server sends [events](./events.md) for the map settings, types, views and lines (without track points). The same types of events will be received later if the respective objects are changed while the connection is open. The client has some default listeners registered that will store the data received as events in its [properties](./properties.md). For example, a `padData` event contains the map settings and is emitted the first time the map ID is set and every time the map settings are changed while the connection is open. The `client.mapData` property always contains the latest state of the map settings.

Note that most methods of the client are asynchronous. Events that the server fires in response to a method call are always fired before the method returns. This is why in the above example, `client.mapData` and the other properties are available right after the `setMapId` call.

### Set a bbox

```js
await client.updateBbox({ top: 53.5566, left: 8.7506, right: 19.8468, bottom: 50.1980, zoom: 8 });
console.log(client.markers, client.lines);
```

Setting the bounding box of the client will cause the server to send events for all the markers within these bounds, and also for any line track points within the bounds, simplified to be appropriate for the specified zoom level. It will also subscribe to any updates to those objects within the bbox.

The bbox can be updated again later to receive the data and change the subscription to objects in that bounding box. (Note that when changing the bounding box, the server will not send events again for objects that were already sent as part of the previous bounding box.)

### Change the map

```js
const newMarker = client.editMarker({ id: 123, title: "New title" });
```

When creating/updating/deleting an object, the data is propagated in multiple ways:
* An event representing the change is fired before the method returns (in the above example, a `marker` event)
* The client property is updated in reaction to the event (in the above example, the updated marker is stored in `client.markers[123]`)
* The method returns the created/updated object.

Note that creating/updating/deleting an object will fail if the operation is not permitted. The above example will fail if the map was opened using its read-only ID.

### Internationalization

Most of the data returned by the client is user-generated and thus not internationalized. There are a few exceptions though, in particular error messages in case someting unexpected happens.

By default, the FacilMap backend detects the user language based on the `Accept-Language` HTTP header. The detected language can be overridden by setting a `lang` cookie or query parameter. In addition, a `units` cookie or query parameter can be set to `metric` or `us_customary`.

For the websocket, the `Accept-Language` header, cookies and query parameters are sent during the socket.io handshake. If you want to force the socket to use a sepcific language, you can pass query parameters through the third parameter of the client constructor:
```js
import Client from "facilmap-client";

const client = new Client("https://facilmap.org/", undefined, {
	query: {
		lang: "en",
		units: "us_customary"
	}
});
```

You can also update the internationalization settings for an existing socket connection at any point using [`setLanguage()`](./methods#setlanguage-settings).

### Deal with connection problems

```js
const client = new Client("https://facilmap.org/");
client.on("connect", () => {
	console.log("connected");
});
client.on("disconnect", () => {
	console.log("disconnected");
});
```

Constructing the client will attempt to connect to the server. socket.io will retry this until it succeeds. Once the connection is made, a `connect` event is fired.

If the connection is lost at some point, a `disconnect` event is fired and socket.io will keep trying to connect again. When it succeeds, a `connect` event is fired again. Since the session on the server is lost when disconnecting, the client will automatically set the last map ID, bbox and routes again on reconnection. This means that events for all the map objects are received again.