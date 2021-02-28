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
npm install --save facilmap-client
```

or

```bash
yarn add facilmap-client
```

or load the client directly from facilmap.org (along with socket.io, which is needed by facilmap-client):

```html
<script src="https://unpkg.com/socket.io-client@3/dist/socket.io.js"></script>
<script src="https://facilmap.org/client.js"></script>
```

The client class will be available as the global `FacilMap.Client` variable.


### Development

Make sure you have yarn installed. Run `npm install` to install the dependencies and `npm run build`
to create the bundle in `dist/client.js`.


Setting up a connection
-----------------------

```js
let conn = new FacilMap.Client("https://facilmap.org/");
conn.setPadId("myMapId").then(() => {
	console.log(conn.padData);
}).catch((err) => {
	console.error(err.stack);
});
```

Using it
--------

A detailed description of all the methods and data types can be found in [API](./API.md).
