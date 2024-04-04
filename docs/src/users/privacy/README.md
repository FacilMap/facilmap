# Privacy

FacilMap aims to be a privacy-friendly open-source alternative to commercial maps that track your data.

FacilMap is a combination of services provided by FacilMap itself and third-party services based on OpenStreetMap. Each of these services might retrieve and store different data about you.

## FacilMap itself

The following data is *processed* but *not persisted* by the FacilMap server:
* Your **IP address**: When you open FacilMap, a connection to the server is made, which inevitably reveils your IP address to the server. FacilMap uses your IP address to guess your location using the [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geoip2/geolite2/) database (to decide the initial map view), but it uses a local copy of that database rather than sending your IP address to MaxMind.
* Your **map position**: When you have a [route](../route/) or a [collaborative map](../collaborative/) open, the current map position is sent to the server every time you move/zoom the map. (In response, the server will send any map objects in your current map view.)
* Your **language settings**: If you have set custom language and/or unit user preferences, these are sent to the server on each request. Otherwise, the language preferences that your browser sends with each request are used.

The following data is *processed* and *persisted* by the FacilMap server:
* When you calculate a [route](../route/), the details about this route are stored on the server until you close the route (or your browser window) again.
* Any [markers](../markers/), [lines](../lines), [types](../types), [views](../views) that you add and any [map settings](../map-settings/) that you make on a [collaborative map](../collaborative/) is stored on the server. Deleting such objects will still keep a copy in the [change history](../history/). The only way to delete the data is to [delete the collaborative map](../map-settings/#delete-the-map).

The following data is persisted in your browser:
* If you change the [zoom settings](../search/#zoom-settings), these are persisted in the local storage of your browser.
* If you add [bookmarks](../collaborative/#bookmark-a-map), these are persisted in the local storage of your browser.
* If you change the language or unit user preferences, these are persisted as a cookie in your browser.

## Layers

Base layers and overlays are embedded from the third-party services listed under [map styles](../layers/). When you enable a particular map layer, the following data is sent to the provider of that layer:
* Your **IP address**
* Your **map position**
* Any **cookies** that the provider might have set (unless you have third-party cookies disabled in your browser)

FacilMap does not have any control over what these providers do with your data, but makes a best attempt to not rely on any providers that are known for tracking you.

## Search/route

When you make a [search](../search/), calculate a [route](../route/) or open a [map point](../click-marker/), a third-party provider is used, so the search terms, your IP address and any cookies set by the provider may be transmitted. The following providers are used:
* [Nominatim](https://nominatim.openstreetmap.org/) to resolve search terms or locations
* [Mapbox](https://www.mapbox.com/) for routes with a simple [route mode](../route/#route-modes)
* [OpenRouteService](https://openrouteservice.org/) for routes with an advanced [route mode](../route/#route-modes)

## External links

Search results and markers/lines may contain links to external websites as part of their details. FacilMap directs such links through a dereferrer page to make sure that the URL of the map you had open is not leaked to the destination of the link.

## Your location

When showing [your location](../locate/) on the map, FacilMap uses the GeoLocation API to ask your browser for your location. It is beyond the control of FacilMap how your browser will find out your location.

Wikipedia contains [some information](https://en.wikipedia.org/wiki/W3C_Geolocation_API#Location_sources) about how browsers determine your location. Usually your browser will send the names and IDs of WiFi networks that your device can receive, your IP address and (if applicable) the ID of your mobile network cell to a third-party provider. Unfortunately, these third-party providers seem to be mostly big companies that collect a lot of data.