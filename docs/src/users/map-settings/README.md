# Map settings

When you have a map open through its [admin link](../collaborative/#urls), you can change its settings by clicking “Tools” in the [toolbox](../ui/#toolbox) and then “Settings”.

## Links

You can change the [admin, editable and read-only link](../collaborative/#urls) here. If you change the admin URL (through which you have opened the map), your browser will automatically update the URL in the address bar.

When changing a link, its previous URL will be available again for a new map to take. No redirect is put in place. So when you change the link, make sure to inform everyone who needs access to the map.

Clicking on the “Copy” button on the right will copy that link into the clipboard.

## Map name

The map name is shown as the title of your browser tab and window. It will also appear in your browser history and when you save the map as a bookmark. When exporting the map, the map name will be used as the default filename of the export.

## Search engines

If you check the “Accessible for search engines” checkbox, search engines like Google or Duckduckgo will be allowed to list the read-only version of the map. Note that FacilMap itself does not report these maps to the search engines, but when they find them through a link on a public website, it is this setting that allows them to add the map to their results.

When this is enabled, an additional field “Short description” is shown. Search engines will list the map with the [map name](#map-name) and this description.

## Cluster markers

When this is checked, when there are many markers in one area, they will be replaced by a placeholder that indicates the number of markers there. To show the markers, you can click the placeholder or zoom in. This improves performance and tidyness on maps with a lot of markers.

## Legend text

The two fields allow specifying custom text that will be shown above and below the [legend](../legend/). [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) can be used for formatting.

## Delete the map

Deleting the map will delete its settings, markers, lines, saved views, custom types and edit history. Deleted maps cannot be restored, unless you have [made a backup](../export/#geojson) by exporting the map as a GeoJSON file. The [URLs](../collaborative/#urls) of deleted maps will be available again and can be used by a new map.

To delete a map, type `DELETE` (in upper-case letters) into the field and press the red “Delete map” button.