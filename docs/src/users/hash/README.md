# Share a link

When you open `https://facilmap.org/`, the URL in the address bar of your browser will change to something like `https://facilmap.org/#8/52.462/13.491/MSfR`. The part starting with the `#` is called the *location hash* and is continuously updated by FacilMap to represent your current view of the map.

This means that if you want to share a link to a specific view of the map, you can simply copy the URL from the address bar of your browser.

The following information is stored in the location hash:
* The coordinates of the centre of the part of the map that you are currently viewing
* The current zoom level
* The current [map style](../layers/) (base layer and overlays)
* One of the following (depending which is active):
	* The selected [search](../search/) result, or the search term if none is selected
	* The [route](../route/)
	* The [map point](../click-marker/)
	* The selected [marker](../markers/) or [line](../lines/) (on [collaborative maps](../collaborative/))
	* The active [view](../views/) (on [collaborative maps](../collaborative/))
* The active [filter](../filter/) (on [collaborative maps](../collaborative/))

## Technical details

The location can have one of the following formats:
* Short format: `#q=<search term>`
* Long format: `#<zoom>/<latitude>/<longitude>/<layers>/<search term>/<filter>`. If the filter and/or search term is empty, the trailing slashes are omitted.

The short format is used if the current map view equals the default view for the search. This means that the map is currently zoomed to the exact location where it would zoom to when opening the result of the search term, and no additional layers or filters are active.

The different components of the long format have the following meaning:
* **zoom:** The zoom level of the map, minimum `0`, maximum `18` (might be higher or lower depending on the layers)
* **latitude:** The latitude of the center of the map, minimum `-90`, maximum `90`
* **longitude:** The longitude of the center of the map
* **layers:** Each layer is identified by a four-character key. If overlays are enabled, they are appended with a `-`. For example `Mpnk` for only Mapnik or `Mpnk-Rlie-grid` for Mapnik, Relief and Graticule.
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