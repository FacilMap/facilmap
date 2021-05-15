# Overview

The Leaflet components of FacilMap are classes that you can use to show FacilMap data on a [Leaflet](https://leafletjs.com/) map.

The Leaflet components are only useful in combination with a [FacilMap client](../client/) instance. Most components either require an object created by the client as an argument, or require the client instance itself and render the available map data automatically.

## Components

* [BboxHandler](./bbox.md) automatically calls [updateBbox()](../client/methods.md#updatebbox-bbox) when the position of the map changes.
* [Layers](./layers.md) provides the layers that FacilMap offers by default and helpers to show them.
* [Markers](./markers.md) shows the markers of a collaborative map.
* [Lines](./lines.md) shows the lines of a collaborative map.
* [Route](./route.md) allows showing a calculated route on the map.
* [Search](./search.md) renders search results.
* [Overpass](./overpass.md) shows amenities and POIs in the current map bounds using the Overpass API.
* [Icons](./icons.md) provides methods to draw marker icons and shapes.
* [HashHandler](./hash.md) hooks up the location hash to the current map view.
* [Views](./views.md) allow controlling the map view and handling saved views.
* [Filter](./filter.md) expressions can be used to control which markers/lines are visible on the map.
* [Click listener](./click-listener.md) is a helper to ask the user to click somewhere on the map.

## Setup

The Leaflet components are published on npm as [facilmap-leaflet](https://www.npmjs.com/package/facilmap-leaflet). The recommended way to use them is to install the package using npm or yarn:

```bash
npm install -S facilmap-leaflet
```

```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { BboxHandler } from "facilmap-leaflet";

const map = L.map('map');
const client = new Client("https://facilmap.org/");
new BboxHandler(map, client).enable();
```

However, a build to use the components directly in the browser is also available. The build contains all the dependencies except Leaflet, including the FacilMap client. The components are available in the global `L.FacilMap` object.

```html
<script src="https://unpkg.com/leaflet@1"></script>
<script src="https://unpkg.com/facilmap-leaflet@3/dist/facilmap-leaflet.full.js"></script>
<script>
	const map = L.map('map');
	const client = new FacilMap.Client("https://facilmap.org/");
	new L.FacilMap.BboxHandler(map, client).enable();
</script>
```

## Example

An example that shows all the Leaflet components in actions can be found in [example.html](https://github.com/FacilMap/facilmap/blob/master/leaflet/example.html) ([demo](https://unpkg.com/facilmap-leaflet/example.html)).