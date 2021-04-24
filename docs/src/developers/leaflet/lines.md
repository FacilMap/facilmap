# Lines

## Show map lines

`LinesLayer` is a Leaflet layer that will render all the lines on a collaborative map with their appropriate styles (colour and width). To use it, open a connection to a collaborative map using the client and add the layer to the map:

```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { LinesLayer } from "facilmap-leaflet";

const map = L.map('map');
const client = new Client("https://facilmap.org/", "myMapId");
const linesLayer = new LinesLayer(client).addTo(map);
```

`LinesLayer` also has the following features:
* Lines get a tooltip with their name.
* It automatically reacts to changes. When lines are created, changed or deleted, these changes are reflected on the map. `LinesLayer` can also be added before a collaborative map is opened, and will draw the lines as soon as a map is opened.
* It shows/hides the appropriate lines if a [filter](./filter.md) is set.

## Handle line clicks

`MarkersLayer` emits a `click` event when a line is clicked. To find out which line was clicked, use `event.layer.line`.

```javascript
linesLayer.on("click", (event) => {
	console.log(event.layer.line);
});
```

You could for example show the line data or highlight the line in reaction to a click.

## Highlight lines

Lines can be highlighted, which will remove their opacity and raise them above other elements on the map. The frontend uses this to present a line as selected.

To highlight a line, use `linesLayer.highlightLine(id)`, `linesLayer.unhighlightLine(id)` or `linesLayer.setHighlightedLines(ids)`. Lines are identified by their ID, which makes it possible to highlight them even before they are actually loaded (they will be highlighted as soon as they are rendered).

This example will highlight a line on click:

```javascript
linesLayer.on("click", (event) => {
	linesLayer.setHighlightedMarkers([event.layer.line.id]);
});
```

## Draw a line

Calling `linesLayer.drawLine(lineTemplate)` starts an interaction where the user can draw a line by adding line points through clicks on the map. The user can finish drawing the line by clicking twice on the map, or you can finish the drawing by calling `linesLayer.endDrawLine(true)`, for example in response to clicking a “Finish” button that you show somewhere.

`lineTemplate` should be a line object with basic styling (`colour` and `width` are defined). Calling `linesLayer.endDrawLine(true)` will finish the operation, while `linesLayer.endDrawLine(false)` will cancel the operation. `linesLayer.drawLine(lineTemplate)` returns a promise that is resolved with the line points (array of objects with a `lat` and `lon` property) when the operation is finished, or with `undefined` when the operation is canceled.

Here is an example how drawing a line could look:
```javascript
document.getElementById("draw-line-button").addEventListener("click", async () => {
	const message = showMessage({
		body: "Click on the map to add line points.",
		actions: [
			{ text: "Finish", onClick: () => { linesLayer.endDrawLine(true); } },
			{ text: "Cancel", onClick: () => { linesLayer.endDrawLine(false); } }
		]
	});

	let routePoints;
	try {
		routePoints = await linesLayer.drawLine({ colour: "0000ff", width: 7 });
	} catch (error) {
		alert(error);
	} finally {
		message.hide();
	}

	if (routePoints) {
		try {
			await client.addLine({ typeId: 1, routePoints });
		} catch (error) {
			alert(error);
		}
	}
});
```

## Render a single line

The code that styles lines on FacilMap has been moved into an external module called [Leaflet.HighlightableLayers](https://github.com/FacilMap/Leaflet.HighlightableLayers). To draw lines that look like FacilMap lines, use that module.

## Hide a line

Calling `linesLayer.hideLine(lineId)` hides a line until `linesLayer.unhideLine(lineId)` is called. The frontend uses this function to temporarily make a line draggable by calling [client.lineToRoute()](../client/methods.md#linetoroute-data) to convert the line to a route and hiding the line until the dragging has finished.