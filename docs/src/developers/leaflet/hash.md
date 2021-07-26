# HashHandler

FacilMap can store the current map view in the location hash. The details can be found in the [User guide](../../users/share/).

`HashHandler` creates a two-way binding between the location hash and the current map view. This means that when the map is loaded and a location hash is set, the map view encoded in the hash is opened. If the location hash changes while the map is open, the new map view is opened. When the map view changes, the location hash is updated to reflect the current map view.

`HashHandler` handles the different details encoded in the location hash in the following way:
* Longitude, latitude, zoom level: automatically synchronised.
* Active layers: automatically synchronised (using the [FacilMap layer helpers](./layers.md)).
* Search term: needs to be synchronised manually (see [below](#search-term)).
* Active filter: automatically synchronised (using the [filter map extension](./filter.md)).

`HashHandler` also has support for saved views. If the position of the map is exactly that of a saved view, the location hash will be set to something like `#q=v123`.

## Usage

`HashHandler` is a [Leaflet handler](https://leafletjs.com/reference.html#handler) whose constructor accepts two arguments, the Leaflet map and a FacilMap client instance. Here is an example how to use it:
```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { HashHandler } from "facilmap-leaflet";

const map = L.map('map');
const client = new Client("https://facilmap.org/", "myMapId");
const hashHandler = new HashHandler(map, client).enable();
```

## HashHandler and initial view

facilmap-leaflet provides helper methods to set the [initial view](./views.md#initial-view) of a map. However, when opening the map with a specific map view already present in the location hash, loading the initial view would cause unnecessary network requests and jumping of the map if the hash handler would move the map position immediately afterwards.

When the hash handler is enabled for the first time, it checks whether a map view is present in the location hash. If there is, it zooms to that view, otherwise it leaves the map position untouched. This means that if the hash handler is enabled on a map whose position is not initialised yet, the position remains uninitialised if no position is present in the location hash. This can be checked by checking whether `map._loaded` is defined or not, and loading the initial view only if it is not.

```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { displayView, getInitialView, HashHandler } from "facilmap-leaflet";

const map = L.map('map');
const client = new Client("https://facilmap.org/", "myMapId");
const hashHandler = new HashHandler(map, client).enable();
if (!map._loaded)
	displayView(map, await getInitialView(this.client));
```

## Search term

The FacilMap frontend uses the 5th part (search term) of the location hash to represent the selected map object, the active search term or the active route. If you want to make use of the search term part, you have to set up a two-way binding yourself.

Calling `hashHandler.setQuery(queryObject)` will notify the hash handler about the active search term and cause it to update the location hash. `queryObject` can be `undefined` or an object with the following properties:
* `query` (string): The search term.
* `center` ([LatLng](https://leafletjs.com/reference.html#latlng), optional): The map center if the map were zoomed exactly to the active query.
* `zoom` (number, optional): The zoom level if the map were zoomed exactly to the active query.

If `center` and `zoom` are specified and the map is exactly at that position, the location hash is shortened to `#q=<search term>` (unless a filter or non-default layers are active).

When the hash handler is enabled or the location hash is changed, an `fmQueryChange` event is fired. The event contains the following properties:
* `query`: The search term (may be an empty string or undefined).
* `zoom`: A boolean that indicates whether the map should zoom to the result or not. This is `true` if the location hash is the shortened form `#q=<search term>` and `false` if it is the long form (which has a fixed map position encoded).

Here is an example how the search term could be hooked up to a search form:

```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { HashHandler, SearchResultsLayer } from "facilmap-leaflet";

const map = L.map('map');
const client = new Client("https://facilmap.org/");
const hashHandler = new HashHandler(map, client).enable();
const resultLayer = new SearchResultsLayer().addTo(map);

async function submitSearch(shouldZoom) {
	const query = document.getElementById("search-input").value;
	if (query.trim() != "") {
		try {
			resultLayer.setResults(await client.find({ query }));

			const bounds = resultLayer.getBounds();
			const center = bounds.getCenter();
			const zoom = Math.min(15, map.getBoundsZoom(resultLayer.getBounds()));
			if (shouldZoom)
				map.flyTo(center, zoom);
			hashHandler.setQuery({ query, center, zoom })
		} catch (err) {
			alert(err);
		}
	} else {
		resultsLayer.setResults([]);
		hashHandler.setQuery(undefined);
	}
}

document.getElementById("search-form").addEventListener("submit", () => {
	submitSearch(true);
});

hashHandler.on("fmQueryChange", (event) => {
	document.getElementById("search-input").value = event.query || "";
	submitSearch(event.zoom);
});
```

## Manual binding

Setting the `simulate` option to `true` will disable the two-way binding between the location hash and the map view. You can use this to set up your own binding using the following features:
* `hashHandler.getHash()` will return a hash string (without leading `#`) representing the current map view.
* `hashHandler.applyHash(hash)` will set the map view to the one represented by the given hash string (without leading `#`).
* The hash handler will emit an `fmHash` event whenever the map view changes. The event object contains a `hash` property containing a hash string (without leading `#`) representing the current map view.

Example setting up a two-way binding between a text field and the map view:
```javascript
const hashHandler = new HashHandler(map, client, { simulate: true }).enable();
hashHandler.on("fmHash", (e) => {
	hashInput.value = e.hash;
});

const hashInput = document.getElementById("#hash-input");
hashInput.value = hashHandler.getHash();
hashInput.addEventListener("change", () => {
	hashHandler.applyHash(hashInput.value);
});
```

## Options

The third argument to the `HashHandler` constructor can be an object with some of the following properties:
* `simulate`: If this is `true`, the actual location hash will neither be read nor updated. The hash handler will only emit an `fmHash` event with the `hash` property of the event object being the location hash representing the current map view.
* `overpassLayer`: This can be an instance of [OverpassLayer](./overpass.md), causing the overpass query to be persisted in the location hash as well.