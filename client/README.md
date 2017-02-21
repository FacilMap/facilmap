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

or load the client directly from facilmap.org:

```html
<script src="https://facilmap.org/client.js"></script>
```

The file `build/client.js` contains the Client class and all its dependencies. You can access
the class using the global variable `FacilMap.Client`.

If you are using webpack, you can alternatively require the Client like this:

```js
import Client from 'babel-loader?presets=es2015!facilmap-client';
```

### Development

Make sure you have yarn installed. Run `yarn run deps` to install the dependencies and `yarn run build`
to create the bundle in `build/client.js`.


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

Using with Angular JS
---------------------

Making sure `$apply` is called when the asynchronous methods of the Client return is easy:

```js
let Client = require("facilmap-client");
let myAngularApp = angular.module("myAngularApp", []);

angular.factory("facilMapClient", ($q, $rootScope) => {
	// We need to overload two methods to make sure that $rootScope.$apply() is
	// called when asynchronous methods return
	class FacilMapClient extends Client {
		_emit(eventName, data) {
			return $q.resolve(super._emit(...arguments));
		}
	
		_simulateEvent(eventName, data) {
			return $rootScope.$apply(() => {
				return super._simulateEvent(...arguments);
			});
		}
	}
	
	// We can use the overloaded class like the regular one
	return new FacilMapClient("https://facilmap.org/");
});

angular.run((facilMapClient) => {
	facilMapClient.setPadId("myMapId").then(() => {
		console.log(facilMapClient.padData);
	}).catch((err) => {
		console.error(err.stack);
	});
});
```
