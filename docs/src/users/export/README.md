# Export a map

A map can be exported as a file, in order to use it in another application or to create a backup.

To export a map, in the [toolbox](../ui/#toolbox), click “Tools” and then one of the “Export” options. Note that when a [filter](../filter/) is active, only the objects that match the filter are exported.

The exports are available under their own URL. In the context menu (right click) of the export links, you can copy the URL to use it elsewhere.

## GeoJSON

When exporting a map as GeoJSON, all markers and lines (or, if a [filter](../filter/) is active, those that match the filter) including their data fields, all [saved views](../views/), and all [types](../types/) that represent the exported markers/lines are exported. This means that if no filter is active, this is suitable to make a backup of the whole map (apart from the [map settings](../map-settings/) and the [edit history](../history/)). Such a file can also be [imported](../import/) again into a map to restore the backup.

## GPX

GPX is a format that is understood by many geographic apps and navigation devices. Exporting a map as GPX will export all markers and lines on the map (or, if a [filter](../filter/) is active, those that match the filter). There are two options:
* **Export as GPX (tracks):** Lines that are calculated routes will be exported as GPX tracks. This means that the whole course of the route is saved in the file.
* **Export as GPX (routes):** Lines that are calculated routes will be exported as GPX routes. This means that only the route destinations are saved in the file, and the app or device that opens the file is responsible for calculating the best route.

The marker/line description and any [custom fields](../types/) will be saved in the description of the GPX objects.

## Table

The table export is a static HTML export of all the markers and lines (or, if a [filter](../filter/) is active, those that match the filter) in table form. All the field values of the markers/lines are shown, along with some metadata (name, coordinates, distance, time).

A separate table for each [type](../types/) is shown. Individual types can be hidden by clicking the down arrow next to their heading.

Table columns can be sorted by clicking on their header.