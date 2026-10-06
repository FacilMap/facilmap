# Changelog

## 2026-03-30

When you calculate a route/line and have the “Load route details” option activated, you can now see statistics about the route (how much of it is what road type, what surface etc.) by clicking on the info button next to the climb/drop info.

## 2026-04-09

The “toilets” and “car parking” POI types now have a small dropdown where you can choose to show only those without a fee. This POI variants functionality can be expanded further in the future, feel free to submit suggestions.

## 2026-04-09

There are now keyboard shortcuts for editing (press <kbd>e</kbd>) and for deleting (press <kbd>Delete</kbd> or <kbd>Backspace</kbd>) markers/lines.

## 2026-04-14

The server that we used to load the POIs had been frequently overloaded recently. FacilMap thus self-hosts the POIs now, so the POIs should load much faster and more reliable now. If you want to contribute to the costs, you can set up a small recurring [donation](https://docs.facilmap.org/users/contribute/).

## 2026-04-14

In the user preferences where you can change the language of the application, you can now see percentages how complete the translation in each language is. If you want to help translate FacilMap into your language, you can do so on our [translation platform](https://hosted.weblate.org/projects/facilmap/).

## 2026-04-30

You can now zoom in further in some map styles. For example, in the default Mapnik style, you can now zoom up to level 19 instead of 18.

## 2026-04-30

The OpenCycleMap style is available again. It had been missing due to a bug.

## 2026-05-10

Markers, lines and polygons (in search results) have a new style. The casing is now always black and 1 pixel thick, and the highlight for selected objects is always white. Previously, there was no highlight, but a thick black casing for light objects and a thick white casing for dark objects. The new styles makes map objects more visible, and it also makes them appear more according to their configured colour.

## 2026-06-10

There is a new map style that highlights toll roads.

## 2026-06-29

There are two new map styles to highlight cycling restrictions and cobblestone roads. When activated, a legend is shown explaining the colours. A legend has also been added for the existing overlay map styles (public transportation, bicycle routes, hiking paths and toll roads).

## 2026-06-30

The “Mapnik Water” and “Sea marks” map styles are available again after the providing service (Freie Tonne) has been revived recently.

## 2026-07-24

You can now add formula fields to your marker and line types. Using the same syntax as for filter expressions, they can display values calculated on the basis of other field values or the marker/line metadata. For example, you could create a “Number of days” field that calculates the number of days for a line based on its distance and a maximum daily distance. The formula can return Markdown to use rich text formatting.

## 2026-07-25

Formula fields can now reference the generated values of other formula fields.

## 2026-08-19

In the map settings, there is now a “Formulas” tab. _Custom functions_ can be defined there to be used in any filter or formula expression on your map. A custom function can also return a simple value to act as a constant. _Route formulas_ allow displaying calculated values when calculating a route while having the map open, without having to save that route as a line.