# Advanced usage

## Internationalization

Most of the data returned by the API is user-generated and thus not internationalized. There are a few exceptions though, in particular error messages in case someting unexpected happens.

By default, the FacilMap backend detects the user language based on the `Accept-Language` HTTP header. The detected language can be overridden by setting a `lang` cookie or query parameter. In addition, a `units` cookie or query parameter can be set to `metric` or `us_customary`.

For the Socket API, the `Accept-Language` header, cookies and query parameters are sent during the socket.io handshake. If you want to force the socket to use a specific language, you can pass query parameters through the second parameter of the client constructor (or of the `io()` function if you are using raw Socket.IO):
```js
import { SocketClient } from "facilmap-client";

const client = new SocketClient("https://facilmap.org/", {
	query: {
		lang: "en",
		units: "us_customary"
	}
});
```

You can also update the internationalization settings for an existing socket connection at any point using [`setLanguage()`](./methods#setlanguage-settings).

For the REST API, you can set the same second parameter for the `RestClient` constructor, or if uing the API manually, set those query parameters.

## Error handling and status codes

The FacilMap REST API will respond with these HTTP status codes if the request is successful:
* `200` (OK): The request was successful and the response contains a body
* `204` (No Content): The request was successful and the response does not contain a body

In case of an error, the following status codes are possible:
* `400` (Bad Request): Some of the path, query or body parameters do not have the right format or are missing.
* `401` (Unauthorized)`: The map slug that you were trying to open requires a password. Either you didn’t specify a password or the password was wrong. See [map slugs, tokens and passwords](#map-slugs-tokens-and-passwords).
* `403` (Forbidden): The map slug lacks the necessary permissions for an operation. For example, you tried to change the map settings with a map slug that does not have the `settings` permission.
* `404` (Not Found): No map with the given slug or no object with the given ID exists.
* `409` (Conflict): Tried to create or update a map with a map slug that is already in use.
* `500` (Internal Server Error): All other errors, including unexpected errors.

When using the FacilMap Client or Socket API, `Error` objects may have a `status` property containing the appropriate status code. The lack of a `status` property indicates a status code `500`.

## Map slugs, tokens and passwords

Each map can have one or more [map links](./types.md#maplink) configured. A map link consists of the following data:
* A _map slug_ is the last part of the URL under which the map can be opened, and it also must be provided in all API requests that access map data.
* A password can be optionally specified, which needs to be provided whenever the map is accessed.
* A set of [map permissions](./types.md#mappermissions) determines what the user is allowed to do whan they opened the map through this link.

Each map must have at least one link with full permissions (including admin). A map can have multiple links sharing the same slug if they all use a password and those passwords are all different. (Note that over the socket you can subscribe to only one of those identical slugs at at a time.)

### Password-protected maps

All API calls that access a map require a map slug to be provided. When accessing a map that requires a password without providing the right password, the API will respond with a `401` error. For the REST API, this will be the HTTP status code; for the Socket API and the REST/Socket Client, an error will be thrown that has a `status: 401` property. You can provide the password in the following way:
* For the REST/Socket Client and for the Socket API, instead of passing a `string` as `mapSlug`, you can pass an object of the shape `{ mapSlug: string; password: string }`. While you are subscribed to a map using `subscribeToMap({ mapSlug, password })`, you _should_ omit the password from any API requests to that map slug through the socket, as that will avoid calculating a password hash on the server side.
* For the REST API, you can use Basic HTTP Authentication, providing any username and the map password. You can send the base64-encoded string `:${password}` as the `Authorization` header.

**Performance note:** When you send authorize yourself by sending a map password to the server, the server needs to calculate the password hash in order to check the password. This calculation is relatively expensive. Because of this, if you are planning to make a lot of subsequent requests to a password-protected map, please use one of the following mechanisms to avoid unnecessary load on the server:
* Either [subscribe to the map](./methods.md#subscribetomap) using the Socket Client or Socket API and make the requests using the map slug without password while you are subscribed. If you are not interested in receiving any map events, you can specify `pick: []` for the subscription.
* Or create a password-less [map token](#map-tokens) and use that instead of the map slug.

### Map tokens

Sometimes you may want to create a link to a map that has restricted permissions. For example, you may want to share a link that exports specific parts of your map to a GPX file. But users should not be able to infer the map slug from this link and use it to get full access to the map.

A map token is a derived version of a map slug that shares the configuration of its corresponding map link but might have its permissions restricted. You can create a map token using the <code>[getMapToken](./methods.md#getmaptoken)</code> method. A map token is a string and can be used in place of a map slug in all API methods. When you use the API using a map token, this map token is used a the map slug also in data received from the API, for example in socket events. When using the API with a map token, the API never reveals the original map slug, as this would be a security hole. Map tokens are valid indefinitely, but they are derived directly from a map slug, meaning that they only work when the map slug of the map is the same as it was when the token was created.

When a map token is derived from a map slug that requires a password, that password also has to be provided when accessing the map using the token, except for password-less map tokens created using `noPassword: true`. Password-less map tokens don’t require a password to access the map, but they are also directly associated with the password that was configured when the token was created. This means that when the password of the associated map link is changed, password-less tokens previously created for it become invalid.

## Reactivity

The various classes of the FacilMap client provide various properties that document the current state of the connection and of the subscribed maps and routes. The classes provide a universal way to subscribe to changes to these properties, so that you can use them in UI frameworks that rely on state change detection.

The `SocketClient` and `SocketClientStorage` classes allow specifying a `reactiveObjectProvider` as part of the options passed as the second constructor parameter. This `reactiveObjectProvider` provides an abstraction to the various reactivity mechanisms used by different UI frameworks. By default, `DefaultReactiveObjectProvider` (exported by facilmap-client) is used. It can be accessed as `client.reactiveObjectProvider` or `storage.reactiveObjectProvider`. In its most simple form, you can subscribe to changes like this:

```typescript
const unsubscribe = client.reactiveObjectProvider.subscribe(() => {
	console.log(client.state.type);
});
```

The `subscribe` method is called every time any reactive value in the client instance (including its subscriptions) is changed. This means that the above code would log the client state basically every time anything changes. To subscribe to changes to only one specific value, use the `select` method:

```typescript
const unsubscribe = client.reactiveObjectProvider.select(() => client.state.type, (type) => {
	console.log(type);
});
```

The `select` method retrieves the result of the first callback every time anything changes, and if the result is different than the previous time, the second callback is called with it. Optionally, you can specify an equality function as the third parameter.

By default, every class instance creates its own reactive object provider, meaning that the provider only reacts to changes inside that particular instance.

While one way to use this reactivity would be to subscribe to the desired data and copy it to a reactive object of your UI framework, another way is to specify your own implementation of the `ReactiveObjectProvider` interface (exported by facilmap-client) that make the class instances themselves reactive. The interface looks like this:
```typescript
interface ReactiveObjectProvider {
	makeReactive: <T extends Record<any, any>>(object: T) => T;
	makeUnreactive: <T extends Record<any, any>>(object: T) => T;
	set: <T extends Record<any, any>, K extends WritableKeysOf<T>>(object: T, key: K, value: T[K]) => void;
	delete: <T extends Record<any, any>>(object: T, key: DeletableKeysOf<T>) => void;
	subscribe: (callback: ReactiveObjectSubscription) => () => void;
	select<T>(selector: () => T, callback: (value: T) => void, isEqual?: (a: T, b: T) => boolean): () => void;
}
```

For the exact details of these methods, check the FacilMap source code, but here are some example adaptations for different UI frameworks:

### Vue.js 3

```typescript
import { DefaultReactiveObjectProvider } from "facilmap-client";
import { reactive } from "vue";

class Vue3ReactiveObjectProvider extends DefaultReactiveObjectProvider {
	override makeReactive<T extends Record<any, any>>(object: T): T {
		return reactive(object);
	}
}
```

### Vue.js 2

```typescript
import { DefaultReactiveObjectProvider } from "facilmap-client";
import Vue from "vue";

class Vue2ReactiveObjectProvider extends DefaultReactiveObjectProvider {
	set<T extends Record<any, any>, K extends WritableKeysOf<T>>(object: T, key: K, value: T[K]): void {
		Vue.set(object, key, value);
		this._notify({ action: "set", object, key, value });
	}

	delete<T extends Record<any, any>>(object: T, key: DeletableKeysOf<T>): void {
		Vue.delete(object, key);
		this._notify({ action: "delete", object, key });
	}
}
```

### Angular.js

```typescript
import { DefaultReactiveObjectProvider } from "facilmap-client";

class AngularJsReactiveObjectProvider extends DefaultReactiveObjectProvider {
	set<T extends Record<any, any>, K extends WritableKeysOf<T>>(object: T, key: K, value: T[K]): void {
		$rootScope.$apply(() => {
			super.set(object, key, value);
		});
	}

	delete<T extends Record<any, any>>(object: T, key: DeletableKeysOf<T>): void {
		$rootScope.$apply(() => {
			super.delete(object, key);
		});
	}
}
```

### React

```javascript
import { useSyncExternalStore } from "react";
import { ReactiveStorageProvider } from "facilmap-client";

function useFacilMapClientSelector(instance, selector) {
	useSyncExternalStore(
		(callback) => instance.reactiveStorageProvider.subscribe(callback),
		() => selector()
	);
}

const MarkerInfo = ({ clientStorage, mapSlug, markerId }) => {
	const marker = useFacilMapClientSelector(clientStorage, () => clientStorage.mapSubscriptions[mapSlug].markers[markerId]);
	return (
		<div>
			Marker name: {marker?.name}
		</div>
	);
}
```

Keep in mind that React’s `useSyncExternalStore` will rerender the component if the resulting _object reference_ changes. This means one the one hand that you cannot use this example implementation on a higher up object of the client (such as `clientStorage` itself or `clientStorage.mapSubscriptions`), as their identity never changes, causing your component to never rerender. And on the other hand that you should avoid using it on objects created in the selector (such as returning `[clientStorage.mapSubscriptions[mapSlug].mapData.id, client.mapSubscriptions[mapSlug].mapData.name]` in order to get multiple values at once), as it will cause your component to rerender every time the selector is called.

## Streams

Some API methods return streamed data. This can be actual binary data, such as the file contents returned by `findUrl`, or a stream of objects, such as the one returned by `getAllMapObjects`.

If you use the socket client, it will return streams of binary data as `ReadableStream<Uint8Array>` [web streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API). Depending on what you are planning to do with the data, the easiest way to consume it is to do `await new Response(stream).text()` (see alternative ways on [Stack Overflow](https://stackoverflow.com/a/72718732/242365)). For streams of objects, the client will return an [async iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols). You can consume it using [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of). Keep in mind to cancel the stream/iterable using `stream.cancel()`, `reader.cancel()` or `iterable.return()` (the latter is called automatically when canceling a `for await...of` loop using `break`, `return` or `throw`) if you want to discard it in the middle of receiving it, to prevent further data from being sent.

If you use the Socket API directly, you will have to handle the socket chunks sent as events manually. Streams are sent over the socket in the following way:
* Where the result is a stream, a string is returned instead by the API. This string is a random ID that acts as a unique identifier for the stream.
* Immediately after the stream ID is returned, the API starts sending `streamChunks` events, with the first parameter being the stream ID and the second parameter an array of chunks. Multiple chunks are aggregated on the server side and emitted as one event. For binary streams, the second parameter is an array of `ArrayBuffer`s; for object streams, it is an array of objects. The `ArrayBuffer`s of binary streams are actually meant to be `Uint8Array`s, but Socket.IO sends those as `ArrayBuffer`s. You can convert them back using `new Uint8Array(arrayBuffer)`.
* At some point, a `streamDone` or `streamError` event is emitted. The `streamDone` error only has one parameter, the stream ID. The `streamError` event has two parameters, the stream ID and the error object (serialized using [serialize-error](https://www.npmjs.com/package/serialize-error)).
* You can abort the stream at any point by emitting a `streamAbort` event from the client side with the stream ID as the argument. If the abort event arrives on the server while the stream is still in progress, the server will emit a `streamError` event with an `AbortError`.

In the REST API, binary streams are simply streamed over HTTP. Object streams are sent as part of a regular JSON document, but this JSON document is created on the fly and sent in a streaming way. In most use cases, there is no use in