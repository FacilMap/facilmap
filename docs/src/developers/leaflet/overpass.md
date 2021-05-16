# Overpass

`OverpassLayer` can be used to show amenities or POIs using the [Overpass API](https://overpass-api.de/). In the code, individual amenities/POIs are referred to as “elements”. Elements are rendered on the map as markers, for elements that represent a way or relation in the OpenStreetMap database, the marker is positioned at their geographical centre.

`OverpassLayer` can be used like this:

```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { OverpassLayer, getOverpassPresets } from "facilmap-leaflet";

const map = L.map('map');
const overpassLayer = new OverpassLayer(getOverpassPresets(["parking"])).addTo(map);
```

Elements are loaded through the Overpass API whenever the bounds of the map change (in reaction to the [`moveend`](https://leafletjs.com/reference.html#map-moveend) event). Some tight limits are applies to that the query to avoid overloading the API and the browser. The result of the load operation and any exceeding of the limits is reported as part of the `loadend` event ([see below](#loading-state)). You might want to listen to those events to inform the user about the load status and ask them to zoom in further.

## Use a preset

Pass an overpass query either as the first argument to the constructor, or set it later by using `overpassLayer.setQuery(query)`. A query can be an array of presets or a string to use a custom query ([see below](#set-a-query)). Passing an empty array, empty string or `undefined` will clear all elements.

facilmap-leaflet provides a list of POI types along with their Overpass queries. The list is taken from [OpenPoiMap](http://openpoimap.org/). Items from this list are referred to as presets. To find out which presets are defined, inspect the `overpassPresets` export or check [its source code](https://github.com/FacilMap/facilmap/blob/master/leaflet/src/overpass/overpass-presets.ts).

`overpassPresets` is an array of categories, each of which contains a list of presets. Each category is an object with the following properties:
* `label`: The name of the category that can be shown to the user.
* `presets`: An array of arrays of presets. Each array of of presets represents a logical group, the UI may render a separator between them. A preset is an object with the following properties:
	* `key`: A unique identifier for the preset.
	* `query`: The overpass query for the preset.
	* `label`: The name of the preset that can be shown to the user.

A preset object can be retrieved directly from `overpassPresets`, or by using the `getOverpassPreset(key)` or `getOverpassPresets(keys)` methods, which resolve preset keys to preset objects. For example, to show parking places and recycling stations, set the query as such:
```javascript
overpassLayer.setQuery(getOverpassPresets(["parking", "recycling"]));
```

To enable the first preset of the first category, use this:
```javascript
overpassLayer.setQuery([overpassPresets[0].presets[0]]);
```

## Set a query

If the Overpass presets don’t fit your use case, you can pass a custom overpass query as the first argument to the constructor to `overpassLayer.setQuery(query)`.

`OverpassLayer` expects only the raw query and will add other statements to it as needed. For example, the query `nwr[amenity=parking]` is sent to the Overpass API as something like `[out:json][timeout:1][bbox:52.4323,13.3269,52.4406,13.3681];nwr[amenity=parking];out center 50;`. Note that `OverpassLayer` only renders a marker at the centre of the Overpass element, it does not render any lines or polygons.

See the OpenStreetMap wiki for a reference of [query statements](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#The_Query_Statement) and for an [overview of tags](https://wiki.openstreetmap.org/wiki/Map_features).

Here are some example queries:
* `nwr[amenity=parking]`: Show all parking spaces (nodes, ways and relations).
* `(nwr[amenity=atm];nwr[amenity=bank][atm][atm!=no];)`: Show ATMs.

To create queries based on user input, you may find the `quoteOverpassString(string)` function useful. It returns the string in quotes and with certain characters escaped. You can use `validateQuery(query)` to validate the syntax of a query. It returns a promise that resolves to `undefined` if the query is fine or otherwise a string with an error message.

## Handle errors

The Overpass API will throw an error when the resource limits are exceeded. `OverpassLayer` will emit an `error` event in that case, with the error message in `event.error.message`. Once the map is moved to a position where element can be loaded again, a `clearerror` event is fired.

```javascript
let flag = undefined;
overpassLayer.on("error", (event) => {
	if (flag)
		flag.close();
	if (event.error.message.includes("timed out") || event.error.message.includes("out of memory"))
		flag = showFlag("Too many results, please zoom in.");
	else
		flag = showFlag(event.error.message);
});
overpassLayer.on("clearerror", () => {
	flag.close();
});
```

## Handle element click

When an element marker is clicked, `OverpassLayer` emits a `click` event. The element can be accessed as `event.layer._fmOverpassElement`. It is an object with the following properties:
* `type`: The type of the OpenStreetMap object, `node`, `way` or `relation`.
* `id`: The ID of the OpenStreetMap object.
* `lat`, `lon`: The coordinates of the object. For ways and relations, this is the geometric centre of the object.
* `tags`: The tags of the OpenStreetMap object. An object that maps keys to values. May be undefined if the object does not have any tags.

```javascript
overpassLayer.on("click", (event) => {
	alert(JSON.stringify(event.layer._fmOverpassElement.tags));
});
```

## Highlight elements

Using `overpassLayer.highlightElement(element)`, `overpassLayer.unhighlightElement(element)` and `overpassLayer.setHighlightedElements(elements)`, you can highlight some elements, causing them to be rendered with an increased outline, no opacity and above other map objects. The frontend uses this to present them as selected.

In this example, an element is highlighted when clicked:
```javascript
overpassLayer.on("click", (event) => {
	overpassLayer.setHighlightedElements(new Set([event.layer._fmOverpassElement]));
});
```

## Loading state

When `OverpassLayer` makes a request to the Overpass API, it fires a `loadstart` event. When the request is finished, a `loadend` event is fired. You might want to listen to these events to show a loading indicator to the user. Note that multiple requests might be going on simultaneously if the user moves the map before a pending request has finished, so you need to keep track of the number of times the events are fired.

```javascript
let pending = 0;
overpassLayer.on("loadstart", () => {
	if (++pending == 1)
		showLoadingSpinner();
});
overpassLayer.on("loadend", () => {
	if (--pending == 0)
		hideLoadingSpinner();
});
```

The `loadend` event object contains a `status` property that gives details about how the request went. It can have one of the following values:
* `OverpassLoadStatus.COMPLETE`: The elements were successfully loaded and shown.
* `OverpassLoadStatus.INCOMPLETE`: Some elements were loaded and shown, but the number of found elements exceeded the limit specified in the [options](#options). This means that the user needs to zoom in further to see the complete set of elements.
* `OverpassLoadStatus.TIMEOUT`: The request exceeded the timeout specified in the [options](#options), so no elements were retrieved. This usually happens when there are way too many results (because the zoom level is very low). The user needs to zoom in to see any results.
* `OverpassLoadStatus.ERROR`: The overpass API has reported an error and no elements were retrieved. The exact error object is available in the `error` property of the event object.
* `OverpassLoadStatus.ABORTED`: Another request has been started in the meantime (because the user moved the map again while the request was still loading). This result can be ignored (apart from updating the number of pending requests), as another request is in progress (or has already succeeded) that supersedes the current request.

A `clear` event is fired whenever the POIs are cleared (for example if an empty query is applied). If you are persisting the latest load status or present it to the user in some way, you might want to reset that in response to the `clear` event.

Here is an example how the status can be presented to the user:
```javascript
import { OverpassLoadStatus } from "facilmap-leaflet";

// This is just an example, in reality you would use a styled element
const overpassStatus = document.createElement("div");
document.body.appendChild(overpassStatus);

overpassLayer.on("loadend", (event) => {
	if (event.status == OverpassLoadStatus.COMPLETE)
		overpassStatus.innerText = "";
	else if (event.status == OverpassLoadStatus.INCOMPLETE)
		overpassStatus.innerText = "Not all POIs are shown because there are too many results. Zoom in to show all results.";
	else if (event.status == OverpassLoadStatus.TIMEOUT)
		overpassStatus.innerText = "Zoom in to show POIs.";
	else if (event.status == OverpassLoadStatus.ERROR)
		overpassStatus.innerText = "Error loading POIs: " + event.error.message;
}).on("clear", () => {
	overpassStatus.innerText = "";
});
```

## Options

An object with options can be specified as the second parameter to the constructor:
* `markerColour`: The colour to use for the element markers. A 6 character hex code, defaults to `000000`.
* `markerSize`: The size to use for the element markers. A number that specifies the height in pixels, defaults to `35`.
* `markerShape`: The shape to use for the element markers. Defaults to the default shape (drop).
* `timeout`: The number in seconds to use as a timeout for Overpass API requests. Defaults to `1`. If this is exceeded, no elements are shown and the `loadend` event will have a `status` of `OverpassLoadStatus.TIMEOUT`.
* `limit`: The maximum number of elements that should be returned by an Overpass request. Defaults to `50`. If this is reached, the loaded elements are shown, but the `loadend` event will have a `status` of `OverpassLoadStatus.INCOMPLETE`.

## Hash

The current query of an Overpass layer can be persisted in the location hash. To enable this, pass `overpassLayer` in the [options of the hash handler](./hash.md#options):
```javascript
const hashHandler = new HashHandler(map, client, { overpassLayer }).enable();
```

The Overpass layer will be represented in the hash by a dynamic overlay name starting with `o_` for presets and `O_` for a custom query.