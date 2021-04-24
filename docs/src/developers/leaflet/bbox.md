# BboxHandler

The FacilMap client needs to tell the current bounding box and zoom level of the map to the server in order to receive the following information:
* If a collaborative map is open, the markers in the specified bounding box
* If a collaborative map is open, the line points in the specified bounding box (simplified for the specified zoom level)
* If a calculated route is active, the route points in the specified bounding box (simplified for the specified zoom level).

BboxHandler automatically calls [updateBbox()](../client/methods.md#updatebbox-bbox) whenever the position of the map changes, either because the user panned the map or because it was changed programmatically.

## Usage

BboxHandler extends [L.Handler](https://leafletjs.com/reference.html#handler). To use it, pass the map and client objects to the constructor and enable the handler.

```javascript
import { map } from "leaflet";
import Client from "facilmap-client";
import { BboxHandler } from "facilmap-leaflet";

const map = map('map');
const client = new Client("https://facilmap.org/");
new BboxHandler(map, client).enable();
```

## Technical details

The bbox is only sent to the server if one of the following conditions are met (because only in these conditions the bbox is relevant for the server):
* A collaborative map is opened
* A route is active

The bbox will be sent as soon as one of these conditions is fulfilled, and each time the position of the map is changed. The bbox is updated when Leaflet fires a [`moveend`](https://leafletjs.com/reference.html#map-moveend) event, so if the user is panning the map around, the bbox is only updated when they are done, not in the process.

If the position of the map is updated programmatically using [`flyTo()`](https://leafletjs.com/reference.html#map-flyto) (or `flyToBounds()`), the destination bbox is already set when the animation starts, so that the map data can already be loaded while the animation is in progress.