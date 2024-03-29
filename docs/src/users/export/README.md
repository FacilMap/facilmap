# Export a map

A map can be exported as a file, in order to use it in another application or to create a backup.

To export a map, in the [toolbox](../ui/#toolbox), click “Tools” and then “Export”. This opens a dialog where you can configure in what format to export the map.

## Formats

### GPX

GPX is a format that is understood by many geographic apps and navigation devices. Exporting a map as GPX will export all markers and lines on the map.

When exporting to GPX, one of three “Route type” options needs to be selected:
* **Track points:** Lines that are calculated routes will be exported as GPX tracks. This means that the whole course of the route is saved in the file.
* **Track points, one file per line (ZIP file):** Like “Track points”, but rather than creating one GPX file containing all markers/lines of the map, a ZIP file will be generated that contains one GPX file with all markers and a folder with one GPX file per line. This is useful for importing the file into OsmAnd, which only supports one track per file.
* **Route points:** Lines that are calculated routes will be exported as GPX routes. This means that only the route destinations are saved in the file, and the app or device that opens the file is responsible for calculating the best route.

The marker/line description and any [custom fields](../types/) will be saved in the description of the GPX objects. The marker/line styles are not exported, with the exception of some basic style settings supported by OsmAnd.

### GeoJSON

When exporting a map as GeoJSON, all markers and lines including their data fields, all [saved views](../views/), and all [types](../types/) that represent the exported markers/lines are exported. This means that if no filter is active, this is suitable to make a backup of the whole map (apart from the [map settings](../map-settings/) and the [edit history](../history/)). Such a file can also be [imported](../import/) again into a map to restore the backup.

### HTML

The HTML export will render a web page that contains a table for each [type](../types/) that lists each marker/line of that type along with all field values and some metadata (name, coordinates, distance, time). Types can be shown/hidden by clicking on the down arrow next to their heading, and the table can be sorted by an individual data attribute by clicking on its column header.

For HTML exports, there additional “Copy to clipboard” export method is available. This will copy the table for a single type into the clipboard. Such a table can be pasted directly into a spreadsheet application such as EtherCalc or LibreOffice Calc.

### CSV

CSV files can be opened by most spreadsheet applications. A CSV export will contain all the markers/lines of a single type, along with their field values and some metadata (name, coordinates, distance, time). Note that CSV only supports plain text, so any rich text formatting will be lost.

## Generate a link

By default, the export dialog will create a file and download or open it. By selecting “Generate link” as the export method, you can copy a URL to the exported file instead. This URL will always generate the file with the lastest map data according to the export settings that you have defined, so you can use it to link to the export from a website or a browser bookmark or to integrate the export with another tool that should periodically create copies of your map data.

## Apply a filter

If you have an active [filter](../filter/), the export dialog will show an additional “Apply filter” option. When this option is enabled, the exported file will only contain the map objects that match the filter.