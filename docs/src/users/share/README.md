# Share a link

When you open `https://facilmap.org/`, the URL in the address bar of your browser will change to something like `https://facilmap.org/#8/52.462/13.491/MSfR`. The part starting with the `#` is called the *location hash* and is continuously updated by FacilMap to represent your current view of the map.

This means that if you want to share a link to a specific view of the map, you can simply copy the URL from the address bar of your browser. Alternatively, you can use the [share dialog](#share-dialog).

The following information is stored in the location hash:
* The coordinates of the centre of the part of the map that you are currently viewing
* The current zoom level
* The current [map style](../layers/) (base layer and overlays)
* The current [POIs](../pois/) (if any)
* One of the following (depending which is active):
	* The selected [search](../search/) result, or the search term if none is selected
	* The [route](../route/)
	* The [map point](../click-marker/)
	* The selected [marker](../markers/) or [line](../lines/) (on [collaborative maps](../collaborative/))
	* The active [view](../views/) (on [collaborative maps](../collaborative/))
* The active [filter](../filter/) (on [collaborative maps](../collaborative/))

## Share dialog

To create a link pointing to a particular map view on FacilMap, click on “Tools” and then “Share” in the [toolbox](../ui/#toolbox).

The following options are available:
* “Include current map view” defines whether the generated link should point to the current view (map position, active map object, ...) of the map. If this option is disabled, the link will point to the default view ([saved default view](../views/#default-view) for [collaborative maps](../collaborative/), otherwise the rough geographical location of the user).
* “Show controls”: Uncheck different UI elements here to hide them when opening the link. This is particularly useful when embedding the map into a web page.
* “Link type” (only for [collaborative maps](../collaborative/)): The [permissions](../collaborative/#urls) that users will have when opening the link.

Click on “Copy” to copy the link to the clipboard.

Under the “Embed” tab you can generate HTML code to embed FacilMap into a web page. Find out more in the [developer documentation](../../developers/embed.md).

## Technical details

The location can have one of the following formats:
* Short format: `#q=<search term>`
* Long format: `#<zoom>/<latitude>/<longitude>/<layers>/<search term>/<filter>`. If the filter and/or search term is empty, the trailing slashes are omitted.

The short format is used if the current map view equals the default view for the search. This means that the map is currently zoomed to the exact location where it would zoom to when opening the result of the search term, and no additional layers or filters are active.

The different components of the long format have the following meaning:
* **zoom:** The zoom level of the map, minimum `0`, maximum `18` (might be higher or lower depending on the layers)
* **latitude:** The latitude of the center of the map, minimum `-90`, maximum `90`
* **longitude:** The longitude of the center of the map
* **layers:** Each layer is identified by a four-character key. If overlays are enabled, they are appended with a `-`. For example `Mpnk` for only Mapnik or `Mpnk-Rlie-grid` for Mapnik, Relief and Graticule. If any [POIs](../pois/) are enabled, they are added to the overlay list with a dynamic key starting with `o_` (presets) or `O_` (custom query), for example `Mpnk-Rlie-grid-o_parking_recycling` for Mapnik, Relief, Graticule, parking places and recycling bins.
* **search term:** Can be one of the following:
	* The name of a place. Will show all results for this search term.
	* The ID of a specific search result in the form `n123`, `w123`, `r123` (representing its corresponding OpenStreetMap node, way or relation ID)
	* A [route query](../route/#use-a-route-query), for example `Berlin to Hamburg`
	* [Coordinates](../search/#search-for-coordinates), for example `52.51704,13.38886` or `geo:52.51704,13.38886?z=11`
	* The URL of a [geographic file](../files/)
	* The ID of a [marker](../markers/) or [line](../lines/) in the form `m123` or `l123` (on [collaborative maps](../collaborative/))
	* The ID of a [view](../views/) in the form `v123` (on [collaborative maps](../collaborative/)). This only works in the short format of the location hash.
	* The ID of an OpenStreetMap object in the form `node 123`, `way 123`, `relation 123` or `trace 123`.
	* Anything else that can be typed into the [search form](../search/).
* **filter:** The currently applied [filter](../filter/) (on [collaborative maps](../collaborative/))