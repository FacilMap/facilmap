# Search

## Show search results

`SearchResultsLayer` renders search results as markers, lines and polygons on the map. The constructor accepts the following arguments:
* `results`: An array of search results as returned by [client.find()](../client/methods.md#find-data). You can also leave this `undefined` and add results later using `setResults()`.
* `options`: An optional object containing the following properties:
	* `markerColour`: A 6-digit colour to use for search result markers, defaults to `000000`
	* `markerSize`: The height of search result markers in pixels, defaults to `35`
	* `markerShape`: The shape of search result markers, defaults to `drop`
	* `pathOptions`: [Path options](https://leafletjs.com/reference.html#path-option) for lines and polygons.

Note that the marker symbol is determined by the type of result.

Example usage:
```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { SearchResultsLayer } from "facilmap-leaflet";

const map = L.map('map');
const client = new Client("https://facilmap.org/");
const resultLayer = new SearchResultsLayer().addTo(map);

document.getElementById("search-form").addEventListener("submit", async () => {
	const query = document.getElementById("search-input").value;
	if (query.trim() != "") {
		try {
			resultLayer.setResults(await client.find({ query }));
		} catch (err) {
			alert(err);
		}
	} else {
		resultsLayer.setResults([]);
	}
});
```

## Handle result click

`SearchResultsLayer` fires a `click` event when a result is clicked. To determine which result was clicked, use `event.layer._fmSearchResult`.

Example:
```javascript
resultsLayer.on("click", (event) => {
	alert(event.layer._fmSearchResult.display_name);
});
```

## Highlight results

Using `resultsLayer.highlightResult(result)`, `resultsLayer.unhighlightResult(result)` and `resultsLayer.setHighlightedResults(results)`, you can highlight some search results, causing them to be rendered with an increased outline, no opacity and above other map objects. The frontend uses this to present them as selected.

A single search result might consist of multiple geometries, for example a marker and a polygon. Highlighting a search result will highlight all those geometries.

In this example, a search result is highlighted when clicked:
```javascript
resultsLayer.on("click", (event) => {
	resultsLayer.setHighlightedResults(new Set([event.layer._fmSearchResult]));
});
```