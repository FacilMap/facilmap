# Icons

FacilMap comes with a large selection of icons and marker shapes. The icons come from the following sources:
* All the [Open SVG Map Icons](https://github.com/twain47/Open-SVG-Map-Icons/) (these are the ones used by Nominatim for search results)
* A selection of [Glyphicons](https://getbootstrap.com/docs/3.4/components/#glyphicons-glyphs) from Bootstrap 3.
* A few icons from [Material Design Iconic Font](https://zavoloklom.github.io/material-design-iconic-font/).
* A selection of icons from [Font Awesome](https://fontawesome.com/).

FacilMap uses these icons as part of markers on the map and in regular UI elements such as buttons.

facilmap-leaflet includes all the icons and marker shapes and provides some helper methods to access them in different sizes and styles.

To make the bundle size smaller, the icons are separated into two sets:
* The *core* icons are included in the main facilmap-leaflet bundle. This includes all all icons that are used by FacilMap as UI elements.
* The *extra* icons are included in a separate file. When you call any of the methods below for the first time for an extra icon, this separate file is loaded using an async import. You can also explicitly load the extra icons at any point of time by calling `preloadExtraIcons()`.

## Available icons and shapes

`iconList` and `shapeList` are arrays of strings that contain the names of all the available icons (core and extra) and marker shapes. The `coreIconList` array contains only the names of the core icons.

In addition to the icons listed in `iconList`, any single character can be used as an icon. Single-character icons are rendered in the browser, they don’t require loading the extra icons.

## Get an icon

The following methods returns a simple monochrome icon.

* `async getIconCode(colour, size, icon)`: Returns a raw SVG object with the code of the icon as a string.
* `async getIconUrl(colour, size, icon)`: Returns the icon as a `data:` URL (that can be used as the `src` of an `img` for example)
* `async getIconHtml(colour, size, icon)`: Returns the icon as an SVG element source code (as a string) that can be embedded straight into a HTML page.

The following arguments are expected:
* `colour`: Any colour that would be acceptable in SVG, for example `#000000` or `currentColor`.
* `size`: The height/width in pixels that the icon should have (icons are square). For `getIconHtml()`, the size can also be a string (for example `1em`).
* `icon`: Either one of the icon name that is listed in `iconList`, or a single letter, or an empty string or undefined to render the default icon (a dot).

## Get a marker icon

The following methods returns a marker icon with the specified shape and the specified icon inside.

* `async getMarkerCode(colour, height, icon, shape, highlight)`: Returns a raw SVG object with the code of the marker as a string.
* `async getMarkerUrl(colour, height, icon, shape, highlight)`: Returns the marker as a `data:` URL (that can be used as the `src` of an `img` for example)
* `async getMarkerHtml(colour, height, icon, shape, highlight)`: Returns the marker as an SVG element source code (as a string) that can be embedded straight into a HTML page.
* `getMarkerIcon(colour, height, icon, shape, highlight)`: Returns the marker as a [Leaflet Icon](https://leafletjs.com/reference.html#icon) that can be used for Leaflet markers. The anchor point is set correctly. The Icon object is returned synchronously and updates its `src` automatically as soon as it is loaded.

The following arguments are expected:
* `colour`: A colour in hex format, for example `#000000`.
* `height`: The height of the marker in pixels. Different marker shapes have different aspect ratios, so the width will differ depending on which shape is used. Note that the height is approximate, it is scaled down for some shapes with the aim that two markers with different shapes but the same `height` should visually appear roughly the same size.
* `icon`: Either one of the icon name that is listed in `iconList`, or a single letter, or an empty string or undefined to render the default icon (a dot).
* `shape`: A shape name that is listed in `shapeList`, or an empty string or undefined to render the default shape (`drop`).
* `highlight`: If this is set to true, the marker is rendered as highlighted (with an increased border width).

## Get an icon for an OSM element

Calling `getIconForTags(tags)` will make a best attempt to return an icon that is appropriate for a given OSM element. `tags` should be an object that maps OSM tag keys to values. The function returns a string representing the name of an icon. If no fitting icon can be found, an empty string is returned.