# Overview

The FacilMap API provides a way to programmatically access and modify collaborative maps, in addition to a few other services (geoip, search/route, proxy to download geographic files). The API is available through REST and through [Socket.IO](http://socket.io/). In addition to the same method of the REST API, the Socket API allows to subscribe to map changes. As a rule of thumb, the REST API can be used when only some individual requests need to be made, but the Socket API should be used when a copy of the current state of (parts of) the map should be kept in memory (this also applies when only one user works on a map – for example, changing a type can result in the style of map objects changing, and by using the Socket API, you would receive the updated type and all the updated objects, whereas with the REST API you would have to guess or download the whole map again).

The FacilMap Client is a TypeScript/JavaScript library that makes it convenient to use the APIs. It also provides a “storage” util that handles the Socket API events to keep a local copy of the map up-to-date, with generic support for reactivity so that it can be used in different UI frameworks (such as Vue, Angular or React).

The API maintains different versions in an attempt to stay backwards compatible with older clients. Have a look at the [changelog](./changelog.md) to find out what has changed when upgrading to a new API version.


## Installing the client

Install facilmap-client as a dependency using npm or yarn:

```bash
npm install -S facilmap-client
```

or import the client from a CDN (only recommended for test purposes):

```html
<script type="module">
	import { SocketClient } from "https://esm.sh/facilmap-client";
</script>
```


## TypeScript

facilmap-client is fully typed using [TypeScript](https://www.typescriptlang.org/). While facilmap-client can be used in a plain JavaScript app without problems, it is strongly recommended to use TypeScript, as it greatly helps to understand the data types of events, methods and properties and to avoid errors.

When using the API directly without the client, the `facilmap-types` package exports all the TypeScript types that are used by the API.


## Socket API usage

Through a single socket connection to the server, you can call any of the [API methods](./methods.md) and subscribe to one or multiple collaborative maps and one or more routes. The subscription will only apply to a specific bbox (rectangular map bounds and zoom level), which you can continuously update if your user pans the map. “Subscribing” to a route means that the server will calculate the route once, cache its trackpoints, and as you change our bbox, send you the track points appropriate for your bbox and zoom level.

If you want to use the FacilMap client, you can use the `SocketClient` class to create a connection to the Socket API. Simply call `new SocketClient(server)` (for example `new SocketClient("https://facilmap.org/")`) to open a connection. You can await the `connectPromise` property of the client to wait for the connection to be established or an error to be thrown. You can find more details in the documentation of the [`SocketClient` class](./classes.md#socketclient).

```typescript
import { SocketClient } from "facilmap-client";

const client = new SocketClient("https://facilmap.org/");
await client.connectPromise;
```

If you want to use the Socket API directly, open a [Socket.IO](https://socket.io/) connection to the server. The FacilMap uses a [Socket.IO namespace](https://socket.io/docs/v4/namespaces/) for each [API version](./changelog.md), for example `v3`, so the socket would be opened for example by calling `io("https://facilmap.org/v3")`. If you are using TypeScript, you can use the `facilmap-types` package to set typings for the Socket.IO client:

```typescript
import type { SocketServerToClientEvents, SocketVersion, SocketClientToServerEvents } from "facilmap-types";
import { io, type Socket } from "socket.io-client";
const socket: Socket<
	SocketServerToClientEvents<SocketVersion.V3>,
	SocketClientToServerEvents<SocketVersion.V3, false>
> = io("https://facilmap.org/v3");
```

The Socket.IO [acknowledgement callback](https://socket.io/docs/v4/emitting-events/#acknowledgements) is used to indicate when an operation has succeeded/failed and possibly to return its result. If you use the client, it handles those callbacks for you and each method returns a promise instead. If you use the Socket API directly, you have to pass the callback as the last parameter. The callback has a Node.js style `(...args: [Error] | [null, Result]) => void` signature:
```typescript
const result = await new Promise((resolve, reject) => {
	socket.emit("updateMarker", "mymap", 123, { name: "New name" }, (err, result) => {
		if (err) {
			reject(err);
		} else {
			resolve(result);
		}
	});
});
```

Note that Socket.IO transmits regular JavaScript values as JSON, with the following side-effects:
* Where `undefined` is sent as a value, `null` arrives. Where `undefined` is sent as an object property, the object will arrive without the property.
* The `data` property of markers and lines arrives as a regular object, making it vulnerable to prototype pollution.

The socket client handles these cases for you, but if you use the Socket API directly, you need to keep them in mind.

Because Socket.IO does not support emitting streams, streams are emitted using one event per chunk. You can read the details about this in the chapter about [streams](./advanced.md#streams).

### Subscibe to a map

With the FacilMap client, you can call the [`subscribeToMap`](./classes.md#subscribetomap) method to subscribe to a collaborative map:

```js
import { SocketClient } from "facilmap-client";

const client = new SocketClient("https://facilmap.org/");
await client.connectPromise;
const mapSubscription = client.subscribeToMap("mymap");
await mapSubscription.subscribePromise;
```

`"mymap"` in the example is the _map slug_, meaning the ID under which you would also open the map in the FacilMap UI. For example, this map would live under `https://facilmap.org/mymap`. The socket will have the permissions associated with this map slug.

When using the Socket API directly, you can call the [`subscribeToMap`](./methods.md#subscribetomap) socket method directly.

Subscribing to map will immediately yield some [events](./events.md) for the map data and all the map types, views and objects. While the subscription is active, events will be yielded in the following cases:
* Someone has made a change to the map. This includes changes made by yourself. Events for the changes you make are always guaranteed to arrive before the promise returned by the causing method is resolved. Changes to markers and line track points are only sent if they are within the current bbox.
* You update the bbox, causing markers and line track points for the new section of the map to be sent.
* You update the subscription options to subscribe to additional data (such as the map history). The events for the additional data are immediately sent.

### Set a bbox

```js
await client.setBbox({ top: 53.5566, left: 8.7506, right: 19.8468, bottom: 50.1980, zoom: 8 });
```

Setting the bounding box of the client will cause the server to send events for all the markers within these bounds, and also for any line track points within the bounds, simplified to be appropriate for the specified zoom level.

The bbox can be updated again later to receive the data and change the subscription to objects in that bounding box. (Note that when changing the bounding box, the server will not send events again for objects that were already sent as part of the previous bounding box.)

The Leaflet [BboxHandler](../leaflet/bbox.md) can be used to automatically update the socket bbox to the current map view of a Leaflet map.

### Change the map

```js
const newMarker = await client.updateMarker("mymap", 123, { title: "New title" });
```

When creating/updating/deleting an object, the data is propagated in multiple ways:
* An event representing the change is fired before the method returns (in the above example, a `marker` event)
* The method returns the created/updated object.

Note that creating/updating/deleting an object will fail if the operation is not permitted. The above example will fail if the map was opened using its read-only map slug.

### Client storage

The [`SocketClientStorage`](./classes.md#socketclientstorage) class provides a way to automatically handle the socket events and store all the data in a JavaScript object that is always up-to-date with the latest data received.

```typescript
import { SocketClient, SocketClientStorage } from "facilmap-client";

const client = new SocketClient("https://facilmap.org/");
const storage = new SocketClientStorage(client);
await client.connectPromise;
const mapSubscription = client.subscribeToMap("mymap");
await mapSubscription.subscribePromise;
console.log(storage.maps["mymap"].mapData);
```

Make sure to instantiate the class _before_ subscribing to the map to make sure that it has a chance to handle the subscription events.

With this class in particular it is worth having a look at the [reactivity](./advanced.md#reactivity) documentation for ways how to subscribe to updates within the storage.

### Deal with connection problems

If the socket connection is lost, the socket client will attempt to reconnect indefinitely, and once reconnected it will restore all subscriptions and the bbox. The `SocketClient` class provides a [`state`](./classes.md#state) property that can be used which state the client is currently in (initial, connected, reconnecting or fatal error):

```typescript
client.reactivityProvider.select(() => client.state, console.log);
```

If you are using the Socket API directly, handling reconnects/disconnects in Socket.IO can be challenging, as the exact behaviour depends on the Socket.IO client options and is not documented very well. Roughly, this is how it works:
* Calling `io()` will connect automatically (unless [`autoConnect`](https://socket.io/docs/v4/client-options/#autoconnect) is `false`, in which case `socket.connect()` has to be called manually)
* A `connect` event is emitted when the connection is successfully established for the first time, as well as each time it is restored after a disconnect
* A `disconnect` event is emitted when the connection to the server is lost. Unless something else was configured, Socket.IO will automatically indefinitely repeatedly try to reconnect.
* A `connect_error` event is emitted when the connection failed. If `socket.active` is `true`, this means that a connection attempt failed, but further attempts will be made (this happens when an established connection was lost). If `socket.active` is `false`, this means that the connection failed an no further attempts will be made (this happens when the first connection attempt fails, for example because the user is offline).

Using the Socket API directly, after a reconnect, the map/route subscriptions and the configured bbox are lost and have to be set again.


## Rest API usage

If you want to use the FacilMap client, you can use the `RestClient` class to make requests to the REST API. Simply call `new RestClient(server)` (for example `new RestClient("https://facilmap.org/")`) to create a client. You can find more details in the documentation of the [`RestClient` class](./classes.md#restclient).

```typescript
import { RestClient } from "facilmap-client";

const client = new RestClient("https://facilmap.org/");
const mapObjects = await client.getAllMapObjects("mymap");
```

The API is hosted under `/_api/<version>/` (for example `/_api/v3/`) on the server. For example, to get map `mymap` with all its objects, you would make a `GET` request to `https://facilmap.org/_api/v3/map/mymap/all`. Have a look at the [API methods](./methods.md) to see which endpoints are available.