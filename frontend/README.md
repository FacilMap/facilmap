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
<facilmap id="map" fm-server-url="https://facilmap.org/" fm-map-id="mymap"></facilmap>
```

`fm-map-id` is the map ID as it would appear on `https://facilmap.org/`**`mymap`**. It can be a read-only or read-write ID.


Development
===========

Make sure to have yarn installed. Install the dependencies using `yarn run deps` and bundle the JavaScript
by running `yarn run build`.

A better way to develop the frontend is to start facilmap-server in dev mode. It will set up a webpack-dev-server that
automatically recompiles the frontend when a file changes, and even delays reloads until compilation has finished.
