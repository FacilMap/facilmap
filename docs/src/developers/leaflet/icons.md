# Icons

FacilMap comes with a large selection of icons (called “symbols” in the code) and marker shapes. The icons come from the following sources:
* All the [Open SVG Map Icons](https://github.com/twain47/Open-SVG-Map-Icons/) (these are the ones used by Nominatim for search results)
* All the [Glyphicons](https://getbootstrap.com/docs/3.4/components/#glyphicons-glyphs) of Bootstrap 3.
* A few icons from [Material Design Iconic Font](https://zavoloklom.github.io/material-design-iconic-font/).
* A selection of icons from [Font Awesome](https://fontawesome.com/).

FacilMap uses these icons as part of markers on the map and in regular UI elements such as buttons.

facilmap-leaflet includes all the icons and marker shapes and provides some helper methods to access them in different sizes and styles.

To make the bundle size smaller, the symbols are separated into two sets:
* The *core* symbols are included in the main facilmap-leaflet bundle. This includes all all symbols that are used by FacilMap as UI elements.
* The *extra* symbols are included in a separate file. When you call any of the methods below for the first time for an extra symbol, this separate file is loaded using an async import. You can also explicitly load the extra symbols at any point of time by calling `preloadExtraSymbols()`.

## Available symbols and shapes

`symbolList` and `shapeList` are arrays of strings that contain the names of all the available symbols (core and extra) and marker shapes. The `coreSymbolList` array contains only the names of the core symbols.

In addition to the symbols listed in `symbolList`, any single character can be used as a symbol. Single-character symbols are rendered in the browser, they don’t require loading the extra symbols.

## Get a symbol

The following methods returns a simple monochrome icon.

* `async getSymbolCode(colour, size, symbol)`: Returns a raw SVG object with the code of the symbol as a string.
* `async getSymbolUrl(colour, size, symbol)`: Returns the symbol as a `data:` URL (that can be used as the `src` of an `img` for example)
* `async getSymbolHtml(colour, size, symbol)`: Returns the symbol as an SVG element source code (as a string) that can be embedded straight into a HTML page.

The following arguments are expected:
* `colour`: Any colour that would be acceptable in SVG, for example `#000000` or `currentColor`.
* `size`: The height/width in pixels that the symbol should have (symbols are square). For `getSymbolHtml()`, the size can also be a string (for example `1em`).
* `symbol`: Either one of the symbol name that is listed in `symbolList`, or a single letter, or an empty string or undefined to render the default symbol (a dot).

## Get a marker icon

The following methods returns a marker icon with the specified shape and the specified symbol inside.

* `async getMarkerCode(colour, height, symbol, shape, highlight)`: Returns a raw SVG object with the code of the marker as a string.
* `async getMarkerUrl(colour, height, symbol, shape, highlight)`: Returns the marker as a `data:` URL (that can be used as the `src` of an `img` for example)
* `async getMarkerHtml(colour, height, symbol, shape, highlight)`: Returns the marker as an SVG element source code (as a string) that can be embedded straight into a HTML page.
* `getMarkerIcon(colour, height, symbol, shape, highlight)`: Returns the marker as a [Leaflet Icon](https://leafletjs.com/reference.html#icon) that can be used for Leaflet markers. The anchor point is set correctly. The Icon object is returned synchronously and updates its `src` automatically as soon as it is loaded.

The following arguments are expected:
* `colour`: A colour in hex format, for example `#000000`.
* `height`: The height of the marker in pixels. Different marker shapes have different aspect ratios, so the width will differ depending on which shape is used. Note that the height is approximate, it is scaled down for some shapes with the aim that two markers with different shapes but the same `height` should visually appear roughly the same size.
* `symbol`: Either one of the symbol name that is listed in `symbolList`, or a single letter, or an empty string or undefined to render the default symbol (a dot).
* `shape`: A shape name that is listed in `shapeList`, or an empty string or undefined to render the default shape (`drop`).
* `highlight`: If this is set to true, the marker is rendered as highlighted (with an increased border width).

## Get a symbol for an OSM element

Calling `getSymbolForTags(tags)` will make a best attempt to return a symbol that is appropriate for a given OSM element. `tags` should be an object that maps OSM tag keys to values. The function returns a string representing the name of a symbol. If no fitting symbol can be found, an empty string is returned.