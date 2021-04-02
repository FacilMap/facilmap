Using the FacilMap client
=========================

The FacilMap client makes a connection to the FacilMap server using [socket.io](http://socket.io/) and
automatically receives updates when markers, lines, the map settings, or any other part of a map is created,
changed or removed. When connecting to the map using the writable ID, it it also makes it possible to make
any modifications to the map that you could make through the web interface, such as creating/changing/removing
markers, lines and views and changing the map settings.

One instance of the Client class represents one connection to one specific collaborative map on one specific
FacilMap server. To receive markers and lines, a bbox has to be set, and only the markers and line points within
that bbox will be received. The bbox can be changed (for example, if the user drags the map), which causes objects
from the new bbox to be received. The Client instance will store all objects that it receives in its [properties](./API.md#properties).

Note that in the methods of the client, a collaborative map will be referred to as __pad__. This is because the
collaborative part of FacilMap used to be a separate software called FacilPad.

Setting it up
-------------

Install facilmap-client as a dependency using npm or yarn:

```bash
npm install -S facilmap-client
```

or load the client directly from facilmap.org (along with socket.io, which is needed by facilmap-client):

```html
<script src="https://unpkg.com/socket.io-client@4"></script>
<script src="https://unpkg.com/facilmap-client@3"></script>
```

The client class will be available as the global `FacilMap.Client` variable.


### Development

Make sure you have yarn installed. Run `yarn install` to install the dependencies and `yarn run build`
to create the bundle in `dist/client.js`.


Setting up a connection
-----------------------

```js
let client = new FacilMap.Client("https://facilmap.org/");
client.setPadId("myMapId").then((padData) => {
	console.log(padData);
}).catch((err) => {
	console.error(err.stack);
});
```


Using it
--------

A detailed description of all the methods and data types can be found in [API](./API.md).


Change detection
----------------

When the FacilMap server sends an event to the client that an object has been created, changed or deleted, the client emits the
event and also persists it in its properties. So you have two ways to access the map data: By listening to the map events and
persisting the data somewhere else, or by accessing the properties on the Client object.

If you are using a UI framework that relies on a change detection mechanism (such as Vue.js or Angular), you can override the methods
`_set` and `_delete`. facilmap-client consistently uses these to update any data on its properties.

In Vue.js, it could look like this:

```javascript
let client = new FacilMap.Client("https://facilmap.org/");
client._set = Vue.set;
client._delete = Vue.delete;
```

In Angular.js, it could look like this:

```javascript
let client = new FacilMap.Client("https://facilmap.org/");
client._set = (object, key, value) => { $rootScope.$apply(() => { object[key] = value; }); };
client._delete = (object, key) => { $rootScope.$apply(() => { delete object[key]; }); };
```

This way your UI framework will detect changes to any properties on the client, and you can reference values like `client.padData.name`,
`client.disconnected` and `client.loading` in your UI components.