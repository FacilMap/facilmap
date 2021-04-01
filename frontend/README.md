Embedding FacilMap into a website
=================================

Using an iframe
---------------

It is perfectly fine to embed a map from [facilmap.org](https://facilmap.org/) into an iframe.

```html
<iframe style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap"></iframe>
```

If you use a map ID that does not exist yet, the “Create Collaborative Map” dialog will be opened when accessing the
map.

You can control the display of different components by using the following query parameters:

* `toolbox`: Show the toolbox (default: `true`)
* `search`: Show the search bar (default: `true`)
* `autofocus`: Autofocus the search field (default: `false`)
* `legend`: Show the legend if available (default: `true`)
* `interactive`: Show certain items (“Create collaborative map”, “Open file”) in the toolbox (default: `false`)

Example:

```html
<iframe style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap?search=false&amp;toolbox=false"></iframe>
```

To synchronize the map state with the location hash (to add something like #9/31/24 to the address bar of the browser to indicate the current map view), add the following script:

```html
<iframe id="facilmap" style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap"></iframe>
<script>
	window.addEventListener("message", function(evt) {
		if(evt.data && evt.data.type == "facilmap-hash" && location.hash != "#" + evt.data.hash)
			location.replace("#" + evt.data.hash);
	});

	function handleHashChange() {
		var iframe = document.getElementById("facilmap");
		iframe.src = iframe.src.replace(/(#.*)?$/, "") + location.hash;
	}

	window.addEventListener("hashchange", handleHashChange);
	if (location.hash)
		handleHashChange();
</script>
```

Directly into a page
--------------------

Install facilmap-frontend as a dependency using npm or yarn:

```bash
npm install --save facilmap-frontend
```

or

```bash
yarn add facilmap-frontend
```

or load the client directly from facilmap.org:

```html
<script src="https://facilmap.org/frontend.js"></script>
```

If you application is using Webpack, require the dependency like this:

```js
import 'facilmap-frontend';
```

Note that for this you will have to look into the [webpack.config.js](./webpack.config.js) file and configure your
loaders in a similar way. To include the whole bundle with all the dependencies, use this instead:

```js
import 'facilmap-frontend/build/frontend';
```

Now, if your web application is already using Angular JS, add `facilmap` as a dependency:

```js
angular.module("myApp", ["facilmap"]);
```

Otherwise, bootstrap FacilMap like this:

```html
<!DOCTYPE html>
<html ng-app="facilmap">
```

Now, anywhere on your page, you can add a `facilmap` element:

```html
<facilmap fm-server-url="https://facilmap.org/" fm-map-id="mymap"></facilmap>
```

`fm-map-id` is the map ID as it would appear on `https://facilmap.org/`**`mymap`**. It can be a read-only or read-write ID.

By default, the search bar, toolbox and legend are added to the map. Alternatively, you can specify your own selection
of components by adding them to the element:

```html
<facilmap fm-server-url="https://facilmap.org/" fm-map-id="mymap">
	<fm-toolbox interactive="true"></fm-toolbox>
	<fm-search autofocus="true"></fm-search>
	<fm-legend></fm-legend>
</facilmap>
```

To keep the current map view saved in the browser’s URL bar, add the `fm-hash` component:

```html
<facilmap fm-server-url="https://facilmap.org/" fm-map-id="mymap" fm-hash></facilmap>
```


Development
===========

Build it yourself
-----------------

Make sure to have the newest version of yarn installed. `package.json` uses resolutions, which are only supported by
recent versions of yarn.

Install the dependencies using `yarn run deps` and bundle the JavaScript
by running `yarn run build`.

A better way to develop the frontend is to start facilmap-server in dev mode. It will set up a webpack-dev-server that
automatically recompiles the frontend when a file changes, and even delays reloads until compilation has finished.

Create an extension
-------------------

The `facilmap` directive exports several useful objects that can be used to write own UI components or features that
extend the map.

### Create a directive

Create an element directive like this:

```javascript
fm.app.directive("myFacilmapExtension", function() {
	return {
		restrict: "E",
		require: "^facilmap",
		scope: {},
		link: function(scope, element, attrs, facilmapController) {
			// Do something here
		}
	};
});
```

This component can then be added to the map like this:

```html
<facilmap fm-server-url="https://facilmap.org/" fm-map-id="mymap">
	<my-facilmap-extension></my-facilmap-extension>
</facilmap>
```

Or create an attribute directive like this:

```javascript
fm.app.directive("myFacilmapExtension", function() {
	return {
		restrict: "A",
		require: "facilmap",
		scope: {},
		link: function(scope, element, attrs, facilmapController) {
			// Do something here
		}
	};
});
```

This component can then be added to the map like this:

```html
<facilmap fm-server-url="https://facilmap.org/" fm-map-id="mymap" my-facilmap-extension></facilmap>
```

### `facilmapController`

`facilmapController` contains, among others, these methods and properties:

* `client`: An instance of `facilmap-client` that automatically starts a digest cycle in any of its methods and has these
            additional methods/properties:
    * `setFilter(filter)`: Sets the current filter expression
    * `filterExpr`: The current filter expression
    * `filterFunc(object)`: Runs the current filter expression against the specified marker/line
* `mapEvents`: An angular scope that acts as an event emitter, broadcasting the following events:
    * `longmousedown`: The user has held the mouse at one point on the map for more than 1 second. A Leaflet `LatLng`
                       object is passed as parameter.
    * `layerchange`: The selection of visible layers has changed
* `map`: The Leaflet map object. When adding layers, add the `fmName` and `fmKey` options to them to make them work with
         the toolbox.
* `getCurrentView(addFilter)`: Returns a view object for the current map view. If `addFilter` is true, the current filter
                               is added to it.
* `displayView(view)`: Pan the map to the specified view
* `addClickListener(listener, moveListener)`: Wait for one click to the map. The `listener` function will receive a
                                              `{lat, lon}` object with the position of the click. The `moveListener`
                                              function will receive a `{lat, lon}` object on every mouse move until the
                                              click. Returns a `{cancel}` object, where `cancel` is a method to cancel
                                              the listener.
* `getLayerInfo()`: Returns a `{base, overlay}` object with arrays that contain information about the layers that the
                    map contains as `{visibility, name, permalinkName, attribution}` objects.
* `showLayer(key, show)`: Makes a layer (in)visible. `key` is the `fmKey` option of the layer, `show` indicates whether
                          the layer should be shown or hidden.
* `loadStart()`, `loadEnd()`: Something starts/finishes loading. A loading indicator will be shown as long as `loadStart()`
                              has been called more often than `loadEnd()`.
* `messages.showMessage(type, message, buttons, lifetime, onclose)`: Show a message. `type` is `success`, `info`, `warning`
     or `danger`, `message` is the message text, `buttons` is an array of `{url, click, label}` objects (`url` is the button
     href, `click` is the click handler), `lifetime` the lifetime in milliseconds if specified, `onclose` a close handler.
     Returns a `{close}` object with a method to close the message.