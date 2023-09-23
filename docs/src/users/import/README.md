<script setup lang="ts">
	import customImportMp4 from "@source/users/import/custom-import.mp4";
	import customImportMobileMp4 from "@source/users/import/custom-import-mobile.mp4";
	import typesMp4 from "@source/users/import/types.mp4";
	import typesMobileMp4 from "@source/users/import/types-mobile.mp4";
</script>

# Import geographic files

FacilMap allows you to [open geographic files](../files/) such as GeoJSON, GPX and KML. When opening a file on a collaborative map, some or all of the objects that are part of the file can be imported to be persisted on the map.

Please note that the only two types of geographic objects that FacilMap knows (at the moment) are markers and lines. In terms of geographic features, these are points and polylines. You can open more complex shapes such as multi-polylines, polygons and multi-polygons in FacilMap, but when importing them, these will be converted into simple polylines.

## Import markers and lines

[Open a file](../files/) and then follow the guides how to [add a search result as a marker](../markers/#add-a-search-result-as-a-marker) and [add a search result as a line](../lines/#add-a-search-result-as-a-line).

Note that points can be imported only as markers, while lines/polygons can only be imported as lines. So if you want to really import all objects from the file, you will have to click twice, once to import all “Marker items as Marker” and once to import all “Line/polygon items as Line”.

## Import a map exported by FacilMap

When you [export a collaborative map as GeoJSON](../export/#geojson), [types](../types/) and [saved views](../views/) are exported along with markers and lines. You can use this function to copy a map or to restore a backup.

When [opening a file](../files/) created by FacilMap, FacilMap will offer some additional options compared to a normal geographical file.

The saved views in the file will be shown at the top of the file objects and the types at the bottom. You can import them into the map by simply clicking the + on the right. The + will only be shown if an identical view/type does not exist yet on the map. Note that importing views/types will always add new ones rather than updating existing ones, so you might end up with two types called “Marker” and two types called “Line”, which you will have to resolve by hand. If you are importing into an empty map, you might want to [delete the existing types](../types/#delete-a-type) before the import to avoid confusion.

<Screencast :desktop="typesMp4" :mobile="typesMobileMp4"></Screencast>

To import all the markers/lines, click “Select all” at the bottom and then “Add selected items to map” and “Custom type mapping…”. This will open a dialog where you can define in detail which objects should be imported as what. If you have already import the types, you can choose the existing types, otherwise an option to import them is offered.

<Screencast :desktop="customImportMp4" :mobile="customImportMobileMp4"></Screencast>

The recommended workflow to import an exported map onto a new empty map is:
1. Delete the default “Marker” and “Line” types on the map
2. Open the exported file
3. Import the views and types by clicking the plus
4. Click “Select all”
5. Click “Add selected items to map” and then “Custom type mapping…”
6. Verify that the suggested mapping is correct and click “Import”
7. Close the tab of the opened file.