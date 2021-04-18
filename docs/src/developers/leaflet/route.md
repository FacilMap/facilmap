# Route

Routes in FacilMap are temporarily stored on the server in the scope of one particular client connection, unrelated to any collaborative map that is opened. This makes it possible that only the track points appropriate for the current bounding box and zoom level have to be received by the client, rather than the whole route in all detail. Multiple routes can be active at the same time by specifying a custom `routeId` when calling [setRoute()](../client/methods#setroute-data).

## Show a route

`RouteLayer` renders a route with one particular `routeId` on the map. As long as no route with that `routeId` is active, no route is shown, and as soon as a route is received, it is automatically rendered. An example usage pattern would be that you have one routing form that uses a fixed `routeId`, which would control the active route using [setRoute()](../client/methods#setroute-data) and [clearRoute()](../client/methods#clearroute-data), and there would be one `RouteLayer` for that `routeId` constantly present on the map which would always show the current state of the route.

The `RouteLayer` constructor accepts the following arguments:
* A client instance
* A `routeId` (string or undefined)
* Layer options (any [Leaflet.HighlightableLayers](https://github.com/FacilMap/Leaflet.HighlightableLayers) can be specified)

Example usage:
```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { RouteLayer } from "facilmap-leaflet";

const map = L.map('map');
const client = new Client("https://facilmap.org/", "myMapId");
const routeLayer = new RouteLayer(client, "routeForm", { raised: true }).addTo(map);
```

## Make a route draggable

Most of the logic to make routes draggable has been moved into the external module [Leaflet.DraggableLines](https://github.com/FacilMap/Leaflet.DraggableLines).

`RouteDragHandler` is an extended version of `DraggableLines` that automatically updates the route points when the route is dragged, causing it to be recalculated.

Example usage:
```javascript
import { RouteDragHandler } from "facilmap-leaflet";

const routeDragHandler = new RouteDragHandler(map, client).enable();
routeDragHandler.enableForLayer(routeLayer);
```