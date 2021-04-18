# Markers

## Show map markers

`MarkersLayer` is a Leaflet layer that will render all the markers on a collaborative map with their appropriate styles (colour, size, icon and shape). To use it, open a connection to a collaborative map using the client and add the layer to the map:

```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { MarkersLayer } from "facilmap-leaflet";

const map = L.map('map');
const client = new Client("https://facilmap.org/", "myMapId");
const markersLayer = new MarkersLayer(client).addTo(map);
```

`MarkersLayer` also has the following features:
* It clusters markers if this has been enabled in the map settings.
* Markers get a tooltip with their name.
* It automatically reacts to changes. When markers are created, changed or deleted, these changes are reflected on the map. `MarkersLayer` can also be added before a collaborative map is opened, and will draw the markers as soon as a map is opened.
* It shows/hides the appropriate markers if a [filter](./map#filter) is set.

## Handle marker clicks

`MarkersLayer` emits a `click` event when a marker is clicked. To find out which marker was clicked, use `event.layer.marker`.

```javascript
markersLayer.on("click", (event) => {
	console.log(event.layer.marker);
});
```

You could for example show the marker data or highlight the marker in reaction to a click.

## Highlight markers

Markers can be highlighted, which will increase their border width, remove their opacity and raise them above other elements on the map. The frontend uses this to present a marker as selected.

To highlight a marker, use `markersLayer.highlightMarker(id)`, `markersLayer.unhighlightMarker(id)` or `markersLayer.setHighlightedMarkers(ids)`. Markers are identified by their ID, which makes it possible to highlight them even before they are actually loaded (they will be highlighted as soon as they are rendered).

This example will highlight a marker on click:

```javascript
markersLayer.on("click", (event) => {
	markersLayer.setHighlightedMarkers([event.layer.marker.id]);
});
```

## Show a particular marker

If you want to make sure that a marker with a particular ID is shown (regardless of whether it is in the current bbox or not), call `markersLayer.showMarker(id)`. This will load the marker from the server if it is not loaded yet. Calling `markersLayer.showMarker(id, true)` will load the marker and fly to it.

## Render a single marker

`MarkerLayer` (in singular, as opposed to `MarkersLayer`) makes it possible to render an individual marker object with its appropriate style. It does not automatically update when the marker changes and can also be used for markers that are not saved on the map.

`MarkerLayer` is based on regular [Leaflet markers](https://leafletjs.com/reference.html#marker), but accepts the following additional options:
* `marker`: A marker object that the marker style will be based on. Only the properties relevant for the style (`colour`, `size`, `symbol` and `shape`) need to be set.
* `highlight`: If this is `true`, the marker will be shown with a thicker border.
* `raised`: If this is `true`, the marker will be rendered above other map objects.

```javascript
import L from "leaflet";
import { MarkerLayer } from "facilmap-leaflet";

const map = L.map('map');
new MarkerLayer([52.5295, 13.3840], {
	marker: { colour: "00ff00", size: 40, symbol: "alert", shape: "pentagon" }
}).addTo(map);
```

## Lock a marker

Locking a marker will disable any position and filter updates for it. It will be shown regardless of whether a filter expression applies to it or not, and updates to its position on the collaborative map will be ignored, although style updates are still applied. The frontend uses this function for its “Move marker” feature. Users wouldn’t want the marker to jump to another place or to disappear while they are dragging it.

To lock a marker, call `markersLayer.lockMarker(markerId)`. To unlock it again, call `markersLayer.unlockMarker(markerId)`.