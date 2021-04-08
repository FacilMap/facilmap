# Open geographic files

With FacilMap you can open geographic files (such as GPX or KML) exported by other apps/devices or by FacilMap itself.

## Supported formats

The following file formats are currently supported:
* **GPX:** Used by many GPS devices and navigation/fitness apps to export tracks and map points.
* **KML:** Used by Google Earth to store geographic features.
* **TCX:** Similar to GPX but with a focus on fitness records.
* **GeoJSON:** Standardized format to store geographical features. Can be used to export [collaborative maps](../collaborative/) without any loss of information.
* **OSM:** Used by [OpenStreetMap](https://www.openstreetmap.org/) to store anything on the map.

## Open a file

There are multiple ways to open a file:
* In the [toolbox](../ui/#toolbox), click “Tools” and then “Open file” to open a file from your local computer.
* Drag a file from your local computer onto the map.
* Enter the URL of a file into the search form to open a file.

This will render the geographic features of the file on the map and open a new tab in the [search box](../ui/#search-box) where the features are listed.

You can open multiple files at once. To close a file again, click the X on the search box tab.

Note that files are opened directly from your hard disk and are not persisted on the map. If you want to persist files, start a [collaborative map](../collaborative/) and [import the files](../import/).

## Show details

The search box tab shows a list of all geographic objects in the opened file. Click on an object in the list to select it and zoom to it. Clicking an object on the map will also select the corresponding object in the list.

By clicking the arrow on the right side of an object in the list, you can show some details about this object. You also have the option there to [use it as a route destination](../route/#use-map-points-as-destinations) (only for markers) or to add them to the map (only for [collaborative maps](../collaborative/)). To get back from the details, click on the blue arrow on the left of the heading.

<Screencast :desktop="require('./details.mp4')" :mobile="require('./details-mobile.mp4')"></Screencast>

## Open an OpenStreetMap object

As a shortcut for opening files from the OpenStreetMap API, you can type `node 123`, `way 123`, `relation 123` or `trace 123` into the search form. Relations are resolved recursively, so if a relation contains other relations, these are rendered as well. This can be a useful way to show complex long-distance route relations. Check out [`relation 80049`](https://facilmap.org/#q=relation%2080049) (Donau-Bodensee-Radweg long-distance cycle route) as an example.