# Calculate a route

FacilMap can calculate the shortest or fastest way to get from one point for another. To calculate a route, open the “Route” tab of the [search box](../ui/#search-box), enter a start and a destination, and press “Go!”.

The route will show up in blue on the map, and information about the distance and duration are shown at the bottom of the route form. The start of the route will be indicated with a green marker and its destination with a red marker. If there are intermediate destinations (see [Add additional destinations](#add-additional-destinations)), these will have yellow markers.

<Screencast :desktop="require('./route.mp4')" :mobile="require('./route-mobile.mp4')"></Screencast>

## Pick destinations

In each destination field, you have the option to type one of the following:
* The name of a place, for example `Berlin` or `Friedrichstraße 100, Berlin`
* Coordinates, for example `52.51704,13.38886` or `52.51704, 13.38886` ([WGS-84](https://en.wikipedia.org/wiki/World_Geodetic_System) coordinates in decimal format)

If there are multiple places with the same name that you have typed in, FacilMap will choose the first match. You can change the match by clicking on the dropdown button to the right of the destination. If you are unsure which suggestion is the right one, hovering one will show a temporary yellow marker in its place, and clicking the zoom icon on its left will zoom the map to it.

<Screencast :desktop="require('./suggestions.mp4')" :mobile="require('./suggestions-mobile.mp4')"></Screencast>

## Add additional destinations

You can add additional destinations, for example if you want to calculate a route from A to B to C (or in other words, from A to C via B).

To add an additional destination, click on the plus icon in the bottom left of the route form. To remove a destination, click on the minus icon on the right of the destination. You can rearrange the destinations by dragging the up/down arrow icon on the left of a destination.

<Screencast :desktop="require('./additional.mp4')" :mobile="require('./additional-mobile.mp4')"></Screencast>

## Use map points as destinations

If you would like to use a specific point on the map as a route destination, you can use the [Map point information](../click-marker/) feature. By pressing a point on the map and holding the mouse/finger there for a second, a new tab opens in the search box with information about what can be found at that point. You can use the “Use as” dropdown menu to use the point as the route start, route destination or to add a new intermediate destination.

You can also use [search results](../search/#show-result-details), [POIs](../pois/#show-details), [points from an opened file](../files/#show-details) and [markers](../markers/) (on a [collaborative map](../collaborative/)) as route destinations through their own “Use as” menu.

<Screencast :desktop="require('./click-marker.mp4')" :mobile="require('./click-marker-mobile.mp4')"></Screencast>

## Drag a route

As an alternative to changing the destinations in the route form, you can also drag a route around:
* To move a route destination to another place, simply drag its green, yellow or red marker around.
* To remove a destination, click its green, yellow or red marker.
* To add an additional destination to the start or the end of the route, drag the plus icon that is shown close to the red and green marker (touch devices: tap the plus icon and then drag the appearing marker).
* To add an additional intermediate destination, simply drag any part of the route (touch devices: tap a part of the route and then drag the appearing marker).

To make it more clear which part of the route you are dragging, when you hover a destination field or its corresponding marker, both get a dark outline. When hovering a part of the route, a dashed line appears in the route form that indicates where a destination would be inserted if you started dragging the route here.

<Screencast :desktop="require('./drag.mp4')" :mobile="require('./drag-mobile.mp4')"></Screencast>

## Route modes

The icons at the bottom of the route form can be used to change the means of transportation for which the route should be calculated. Other than driving, cycling and walking there is also a straight line option (useful to calculate the direct distance between two points).

Clicking the cog icon opens a menu where some more specific route modes (for example road bike, mountain bike, electric bike) and some additional settings are available.

For simple driving, cycling or walking, FacilMap uses [Mapbox](https://docs.mapbox.com/api/navigation/directions/) (based on [OSRM](https://www.project-osrm.org/)) to calculate routes. If any advanced settings from the dropdown menu are selected, [OpenRouteService](https://openrouteservice.org/) is used. Mapbox is faster, but OpenRouteService provides more options. If one of the two services doesn’t work properly, it might be worth changing the route mode to make FacilMap use the other.

<Screencast :desktop="require('./mode.mp4')" :mobile="require('./mode-mobile.mp4')"></Screencast>

## Elevation profile

In the dropdown menu under the cog icon, there is an option “Load route details”. When this option is enabled, elevation information is shown for routes.

In addition to the total distance and duration, the total climb and drop are shown under the route form. Clicking on the info icon next to this information will show details about the distribution of steepness.

An elevation graph is shown under the route information. Hovering the elevation graph will show details about the route at the specific point where you hovered and highlight that point on the map.

By default, the elevation graph also highlights different road surfaces (asphalt, gravel, ...) in different colours. Hover “Legend” in the bottom left of the graph to see what the different colours mean, or hover a specific point on the graph to see more details. You can use the arrows on the bottom right of the graph to switch the highlighting from road surfaces to waytypes (road, track, path, ...), steepness or toll roads (only for car routing).

<Screencast :desktop="require('./elevation.mp4')" :mobile="require('./elevation-mobile.mp4')"></Screencast>

## Use a route query

You can type a route description in the shape of `A to B` into the search form. This will automatically switch to the routing form with the specified destinations.

<Screencast :desktop="require('./query.mp4')" :mobile="require('./query-mobile.mp4')"></Screencast>

If you have [configured FacilMap as a search engine](../search/#configure-a-browser-search-engine) in your browser, this can be a useful shortcut to calculate a route by typing something like `facilmap.org Berlin to Hamburg` or `fm Berlin to Hamburg` into the address bar of your browser (depending which keyword you have configured).

Here are some example queries:
* `Berlin to Hamburg`
* `from Berlin to Hamburg`
* `Berlin to Hamburg to Bremen`
* `Berlin to Bremen via Hamburg`
* `Berlin to Hamburg by car`
* `Berlin to Hamburg by walk`
* `Berlin to Hamburg by mountain bike details avoid steps ferries`

## Live navigation

FacilMap does not support live navigation yet. You can [show your location](../locate/) on the map and use it to follow a route, but no turning instructions will be shown and the route does not recalculate if you take a wrong turn.

## Export a route

At the bottom of the route form, the “Export” button allows you to download the route as a file. The following formats are available:

* **GPX track:** GPX files can be imported into many navigation devices/apps. The file will contain the whole route as shown on the screen.
* **GPX route:** GPX files can be imported into many navigation devices/apps. The file will contain only a list of the route destinations that you have specified, and your device/app is responsible for calculating the route between them.

## Share a link

FacilMap continuously updates the location hash (the part after the `#` in the address bar of your browser) to represent what you currently view on the map. More information can be found under [Share a link](../hash/).

When you calculate a route, this is also persisted in the location hash. This means that you can use the URL straight from the browser address bar to share a link to a specific route.

Links to a route will have the following format:
* [`https://facilmap.org/#q=Berlin%20to%20Hamburg%20by%20car`](https://facilmap.org/#q=Berlin%20to%20Hamburg%20by%20car): Calculate a route from Berlin to Hamburg by car and zoom to the route.
* [`https://facilmap.org/#q=n240109189%20to%20n20833623%20by%20car`](https://facilmap.org/#q=n240109189%20to%20n20833623%20by%20car): Calculate a route between these specific place IDs (they represent the first search results for “Berlin” and “Hamburg”) and zoom to the route.
* [`https://facilmap.org/#10/52.5526/13.2536/Mpnk/n240109189%20to%20n20833623%20by%20car`](https://facilmap.org/#10/52.5526/13.2536/Mpnk/n240109189%20to%20n20833623%20by%20car): Calculate a route between these specific place IDs, do not zoom to the route but centre the map at coordinates 52.5526,13.2536 and zoom level 10.