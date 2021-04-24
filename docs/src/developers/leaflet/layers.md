# Layers

In Leaflet, a lot of different types of objects are layers internally, for example tile layers, polylines, markers and even tooltips. In the context of FacilMap, there are base layers (tile layers that make up the main map style, only one can be active at a time) and overlays (layers that are shown on top of the base layer). These layers are used in the following way:
* The frontend offers the user to change which base layer and which overlays are visible
* [Saved views](./views.md) contain information about which base layer and which overlays should be visible
* The [location hash](./hash.md) stores which base layer and which overlays are visible.

facilmap-leaflet maintains a list of available base layers and overlays. This list is used by the layer picker in the frontend to show the available layers to the user, but it is also used when for views and the location hash to distinguish which layers on a map are FacilMap layers and which are other types of Leaflet layers.

The methods on this page make it possible to add FacilMap’s default selection of layers to a map and to modify that selection.

## Get the available layers

To get the available layers, call `getLayers(map)`. It returns an Object whose `baseLayers` and `overlays` properties contain an object that maps a key to a Leaflet layer. The key is used to identify the map in the location hash or in a saved view. The reason why the map has to be passed as an argument is that a Leaflet layer object can only be used on one map at a time. Internally, `getLayers(map)` persists the list of maps in the `_fmLayers` property of the map.

The following example shows how to add a [Leaflet Layers control](https://leafletjs.com/reference.html#control-layers) to the map that shows all the available layers. Note that the control expects objects mapping the layer name to the layer, while the objects returned by `getLayers(map)` map the layer key to the layer, so a mapping has to be done. FacilMap layers use the `fmName` option to store their display name.

```javascript
import L from "leaflet";
import { getLayers } from "facilmap-leaflet";

const map = L.map('map');
const layers = getLayers(map);
const byName = (layerMap) => Object.fromEntries(Object.entries(layerMap).map(([key, layer]) => [layer.options.fmName || key, layer]));
L.control.layers(byName(layers.baseLayers), byName(layers.overlays)).addTo(map);
```

## Change the available layers

To change the available layers for a particular Leaflet map, set the `_fmLayers` properties of that map.

```javascript
import L from "leaflet";

const map = L.map('map');
map._fmLayers = {
	baseLayers: {
		test: L.tileLayer("...", { fmName: "Test" })
	},
	overlays: {
		ovr1: L.tileLayer("...", { fmName: "Overlay 1" })
	}
};
```

To change the available layers for all maps, use `setLayers()`:

```javascript
import { setLayers } from "facilmap-leaflet";

setLayers(() => ({
	baseLayers: {
		test: L.tileLayer("...", { fmName: "Test" })
	},
	overlays: {
		ovr1: L.tileLayer("...", { fmName: "Overlay 1" })
	},
	fallbackLayer: "test"
}));
```

Note that `setLayers()` only affects how the `_fmLayers` property is created, it does not affect the `_fmLayers` properties of existing maps. This means that it has to be called before any part of the code accesses the layers of the map.

The FacilMap frontend uses the `fmName` option to decide under which name to show a layer. The layer key needs to be unique and should by convention be 4 characters long.

If you want to extend the default selection of layers, you can get it using `createDefaultLayers()`:

```javascript
import { createDefaultLayers, setLayers } from "facilmap-leaflet";

setLayers(() => {
	const layers = createDefaultLayers();
	layers.baseLayers.test = L.tileLayer("...", { fmName: "Test" });
	layers.overlays.ovr1: L.tileLayer("...", { fmName: "Overlay 1" });
	return layers;
}));
```

## Get the visible layers

To find out which of the FacilMap layers are currently visible, use the `getVisibleLayers(map)` function. It returns an object with the following properties:
* `baseLayer`: A string that contains the layer key of the currently visible base layer
* `overlays`: An array of strings with the layer keys of the currently visible overlays

## Set the visible layers

`setVisibleLayers(map, visibleLayers)` can be used with an object of the same shape as returned by `getVisibleLayers(map)`:

```javascript
import L from "leaflet";
import { setVisibleLayers } from "facilmap-leaflet";

const map = L.map('map');
setVisibleLayers(map, { baseLayer: "Mpnk", overlays: ["Hike", "Rlie"] });
```

If `visibleLayers` is not specified, it defaults to `{ baseLayer: "Mpnk", overlays: [] }`.

The helper functions `setBaseLayer(map, baseLayer)` and `toggleOverlay(map, overlay)` can be used to change the visibility of individual layers:

```javascript
import L from "leaflet";
import { setBaseLayer, toggleOverlay } from "facilmap-leaflet";

const map = L.map('map');
setBaseLayer(map, "Mpnk");
toggleOverlay(map, "Hike");
```

To find out the key of an existing layer, open [https://facilmap.org/](https://facilmap.org/), enable the desired layer and find the layer key in the location hash in the address bar of your browser. For example, when Mapnik and Hiking paths are enabled, the URL will look like this: <code>https://facilmap.org/#9/52.5196/13.4069/<strong>Mpnk-Hike</strong></code>.