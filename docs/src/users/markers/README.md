<script setup lang="ts">
	import addMp4 from "@source/users/markers/add.mp4";
	import addMobileMp4 from "@source/users/markers/add-mobile.mp4";
	import addResultMp4 from "@source/users/markers/add-result.mp4";
	import addResultMobileMp4 from "@source/users/markers/add-result-mobile.mp4";
	import addResultsMp4 from "@source/users/markers/add-results.mp4";
	import addResultsMobileMp4 from "@source/users/markers/add-results-mobile.mp4";
	import moveMp4 from "@source/users/markers/move.mp4";
	import moveMobileMp4 from "@source/users/markers/move-mobile.mp4";
	import removeMp4 from "@source/users/markers/remove.mp4";
	import removeMobileMp4 from "@source/users/markers/remove-mobile.mp4";
</script>

# Markers

A marker is a point on the map that has a name, a certain style (shape, icon, size, colour) and some data (such as a description). When you add a marker to a map, it is permanently saved there and visible for anyone who is viewing the map.

By default, a collaborative map has one type of marker called “Marker” that has a description field and whose style can be configured freely. Other types of markers with fixed styles and additional fields can be defined using [custom types](../types/). For simplicity, the descriptions on this page are assuming that you are working with the default “Marker” type.

## Add a marker

To add a marker, click on “Add” in the [toolbox](../ui/#toolbox) and then “Marker”. A message will appear that asks you to click on the map to add a marker, along with a “Cancel” button to cancel the operation. Once you click somewhere on the map, a marker is added there and a [search box](../ui/#search-box) tab opens with information about the marker.

<Screencast :desktop="addMp4" :mobile="addMobileMp4"></Screencast>

The new marker is called “Untitled marker”, has the default style and no description. As a next step, you might want to [edit the marker details](#edit-marker-details) to give it a name and change its style.

## Add a search result as a marker

An alternative way to add a marker is to add a [search result](../search/), a [POI](../pois/), a marker from an [opened geographic file](../files/) or a [map point](../click-marker/) as a marker to the collaborative map.

In the search box tab of that object, click on “Add to map” and then “Marker”. The marker will be created with the name of the result. If the marker is a [custom type](../types/), a mapping from the result info to the marker data is attempted, for example if the marker has a field “Address”, it will be filled with the address of the result.

<Screencast :desktop="addResultMp4" :mobile="addResultMobileMp4"></Screencast>

You can also add multiple results at once. In the search form, select multiple items by using the “Select all” button or clicking individual items while holding the Ctrl key. Then click “Add selected items to map” and then “Marker items as Marker”. (In case of an opened geographic file, some of the selected items may be polygons or polylines, these will not be added, as they are not “Marker items”.)

<Screencast :desktop="addResultsMp4" :mobile="addResultsMobileMp4"></Screencast>

## Show marker details

When you click on a marker, it is highlighted and a [search box](../ui/#search-box) tab appears with the name, coordinates and data (such as description). To close the marker details, click on the X on the tab or click somewhere else on the map. This will only hide the marker details for you, it will not delete the marker.

## Edit marker details

To edit the details of a marker, select the marker and then click “Edit data” in its [search box](../ui/#search-box) tab. A dialog will open where you can edit the following fields:
* **Name:** The name of the marker. Will be shown as the heading in the marker details and as a tooltip when hovering the marker.
* **Colour:** The colour of the marker.
* **Size:** The size of the marker (height in pixels). Use the + and &minus; buttons to change the value.
* **Icon:** An icon to show inside the marker shape. You can leave it empty (will show a dot), select an icon from the list, or type in a single character (such as `1`).
* **Shape:** The shape of the marker.
* **Description:** The description of the marker. Will be shown in the marker details. You can format the text using [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet).

Click “Save” to save your changes.

## Move a marker

To change the position of a marker, select the marker and then click “Move” in its [search box](../ui/#search-box) tab. A message will appear at the top right of the screen. Now drag the marker to the desired position, and once you are done, click “Finish” in the message. To keep it at its old position, cancel the operation by clicking “Cancel”.

<Screencast :desktop="moveMp4" :mobile="moveMobileMp4"></Screencast>

## Remove a marker

To remove a marker from the map, select the marker, click “Remove” and confirm the alert box. Note that removed markers will remain in the [edit history](../history/) of the map and can be seen and restored there by admins.

<Screencast :desktop="removeMp4" :mobile="removeMobileMp4"></Screencast>

You can also remove multiple markers at once by [handling multiple objects](../multiple/).