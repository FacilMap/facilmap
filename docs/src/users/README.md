# Overview

FacilMap is a privacy-friendly, open-source versatile online map that combines different services based on [OpenStreetMap](https://www.openstreetmap.org/). FacilMap offers the following features:

* ([Overview over the UI elements](./ui/))
* [Show different map styles](./layers/), for example maps optimized for driving, cycling, hiking or showing the topography or public transportation networks.
* [Search for places](./search/)
* [Calculate a route](./route/), optionally showing the elevation profile.
* [Find out what is at a particular point on the map](./click-marker/)
* [Open geographic files](./files/), for example GPX, KML or GeoJSON files
* [Show your location on the map](./locate/)
* [Share a link](./hash/) to a particular view of the map.
* Add FacilMap as an [app](./app/) to your device.
* FacilMap is [privacy-friendly](./privacy/) and does not track you.

In addition, FacilMap allows you to create collaborative maps, where you and others can add markers, draw lines, save routes and import GPX/KML/GeoJSON files, which will be saved under a custom URL.
* [Creating collaborative maps](./collaborative/)
* [Add markers](./markers/)
* [Add lines/routes](./lines/)
* [Handle multiple objects](./multiple/), for example to delete multiple markers/lines at once.
* By default, markers/lines/routes have a name and a description. You can [define additional fields](./types/) that contain more detailed information and can automatically influence the style of the marker/line/route.
* [Add a legend](./legend/) that shows which colour/style belongs to which type of marker/line.
* [Saved views](./views/) reference a particular area on the map with certain settings. You can change the default view of a collaborative map or save additional views as a shortcut for users to navigate to a certain area on the map.
* [Filters](./filter/) make it possible to temporarily hide certain types of markers/lines based on certain criteria.
* Modifications to the map are logged in the [edit history](./history/) and can be reverted if necessary.
* [Export](./export/) the map or parts of it as a GPX or GeoJSON file or as a table.
* [Import](./import/) GPX, KML or GeoJSON files. Importing a GeoJSON file that was exported by FacilMap makes it possible to copy parts of one map onto another.
* Adjust the [map settings](./map-settings/). This is also where your can [delete the map](./map-settings/#delete-the-map).

If you are interested in embedding FacilMap into your website or even running your own FacilMap server, check out the [Developer guide](../developers/).