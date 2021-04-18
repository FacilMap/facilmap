# Click listener

The click listener is a helper that requires the user to click one point on the map. The frontend uses this in the “Add marker” function for example. While the click listener is active, the mouse cursor changes into a crosshair and it is not possible to click any objects on the map anymore, but it is still possible to move the map around.

Calling `addClickListener(map, listener, moveListener)` will enable the click listener. The listener waits for one click and then disables itself again. If you need to listen for multiple clicks in a row, simply enable another click listener when the user clicks. The method returns an object that contains a `cancel()` method, which you can use to manually cancel the handler. `addClickListener` accepts the following arguments:
* `map` ([Map](https://leafletjs.com/reference.html#map)): The Leaflet map
* `listener` (Function): A function that will be called once with the coordinates of the click (an object with a `lat` and `lon` property). Note that if the listener is canceled using the `cancel()` method, the listener is not called.
* `moveListener` (Function, optional): A function that will be called continuously with the mouse coordinates (an object with a `lat` and `lon` property) as the user moves the mouse across the map. Note that on touch devices, `listener` will be called without `moveListener` ever being invoked.

## Interaction event

When a click listener is enabled, the map will fire an `fmInteractionStart` event. When it is finished, the map will fire an `fmInteractionEnd` event. You can listen to these events to disable certain UI actions that themselves need to add a click listener or that otherwise don't make sense while a click listener is active. For example, the FacilMap frontend disables the “Add marker” and “Move marker” actions while a click listener is active, and does fire its own `fmInteractionStart` event when a marker is made draggable as part of a “Move marker” action.

## Example

Here is an example how a click listener could be used to add a marker to the map:

```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { addClickListener } from "facilmap-leaflet";

const map = L.map('map');
const client = new Client("https://facilmap.org/", "myMapId");

map.on("fmInteractionStart", () => {
	document.getElementById("add-marker-button").disabled = true;
});
map.on("fmInteractionEnd", () => {
	document.getElementById("add-marker-button").disabled = false;
});

document.getElementById("add-marker-button").addEventListener("click", () => {
	const message = showMessage({
		body: "Please click on the map to add a marker.",
		actions: [
			{ label: "Cancel", onClick: () => { clickListener.cancel(); } }
		]
	});

	const clickListener = addClickListener(map, async (point) => {
		message.hide();

		try {
			const marker = await client.addMarker({
				lat: point.lat,
				lon: point.lon,
				typeId: 1
			});
		} catch (err) {
			alert(err);
		}
	});
});
```