# Types

The [facilmap-types](https://www.npmjs.com/package/facilmap-types) package contains TypeScript typings for all the basic types used by the different components of FacilMap. Using TypeScript can be helpful to get some assistance what kind of properties an object provides and expects.

## Bbox

A bounding box that describes which part of the map the user is currently viewing.

* `top` (number, min: -90, max: 90): The latitude of the north end of the box
* `bottom` (number, min: -90, max: 90): The latitude of the south end of the box
* `left` (number, min: -180, max: 180): The longitude of the west end of the box
* `right` (number, min: -180, max: 180): The longitude of the east end of the box
* `zoom` (number, min: 1, max: 20): The current zoom level. This is relevant for the density of track points that should be received.

## Marker

* `id` (number): The ID of this marker
* `lat` (number, min: -90, max: 90): The latitude of this marker
* `lon` (number, min: -180, max: 180): The longitude of this marker
* `name` (string): The name of this marker
* `colour` (string): The colour of this marker as a 6-digit hex value, for example `ff0000`
* `size` (number, min: 15): The height of the marker in pixels
* `symbol` (string): The symbol name for the marker. Default is an empty string.
* `shape` (string): The shape name for the marker. Default is an empty string (equivalent to `"drop"`).
* `ele` (number or null): The elevation of this marker in metres (set by the server)
* `typeId` (number): The ID of the type of this marker
* `data` (<code>{ &#91;fieldName: string&#93;: string }</code>): The filled out form fields of the marker. This is a null-prototype object to avoid prototype pollution.

## Line

Each line has `routePoints` and `trackPoints`. The `routePoints` are the start, end and via points that the user created
for that line, the `trackPoints` describe how the line should be drawn. If no routing is used, `routePoints` and
`trackPoints` are equal, but with routing, there will be a lot more `trackPoints` than `routePoints`.

When creating or updating a line, the `trackPoints`, `distance` and `time` properties are automatically calculated by
the server. Only when the routing mode is `track`, the `trackPoints` can be specified by hand (meant for importing
existing tracks, for example from a GPX file). The `idx`, `zoom` and `ele` properties of the track points are added by
the server automatically.

Note that `line` objects coming from the server don’t contain the `trackPoints` property, but the track points are sent
separately through `linePoints` events.

* `id` (number): The ID of this line
* `routePoints` (`[{lat, lon}]`): The route points
* `mode` (string): The routing mode, an empty string for no routing, or `car`, `bicycle`, `pedestrian`, or `track`
* `colour` (string): The colour of this marker as a 6-digit hex value, for example `0000ff`
* `width` (number, min: 1): The width of the line
* `name` (string): The name of the line
* `distance` (number): The distance of the line in kilometers (set by the server)
* `ascent`, `descent` (number): The total ascent/descent of the line in metres (set by the server)
* `time` (number): The time it takes to travel the route in seconds (only if routing mode is `car`, `bicycle` or `pedestrian`) (set by the server)
* `left`, `top`, `right`, `bottom` (number): The bounding box of the line (set by the server)
* `extraInfo` (<code>{ &#91;type: string&#93;: Array<&#91;startIdx: number, endIdx: number, type: number&#93;>> }</code> or null): Extra details about the route (set by the server). `type` can be for example `steepness`, `surface` or `waytype`. `startIdx` and `endIdx` describe a segment on the trackpoints of the route, the meaning of `type` can be seen in the documentation of [Leaflet.Heightgraph](https://github.com/GIScience/Leaflet.Heightgraph/blob/master/example/mappings.js).
* `typeId` (number): The ID of the type of this line
* `data` (<code>{ &#91;fieldName: string&#93;: string }</code>): The filled out form fields of the line. This is a null-prototype object to avoid prototype pollution.
* `trackPoints`:
  * In the `lines` property of the client, an object of the format [<code>{ &#91;idx: number&#93;: TrackPoint }</code>](#trackpoint)
  * When creating/updating a line with the routing mode `track`, an array of the format [`TrackPoint[]`](#trackpoint)

## TrackPoint

All track points have a `zoom` level and are only received when the zoom level of the current bbox is at least that
level. This makes sure that at a small zoom level, only a low resolution of the line has to be downloaded. When zooming
in, only the additional track points are retrieved. They can be merged into the already retrieved track points using
their `idx` property.

* `idx` (number): The index of this track point in the list of all track points of this line
* `lat` (number, min: -90, max: 90): The latitude of this point
* `lon` (number, min: -180, max: 180): The longitude of this point
* `zoom` (number, min: 1, max: 20): The miminum zoom level from which this track point makes sense to show
* `ele` (number or null): The elevation of this track point in metres (set by the server). Not set for high zoom levels.

## PadData

* `id` (string): The read-only ID of this map
* `writeId` (string): The read-write ID of this map (not set when opened through its read-only ID)
* `adminId` (string): The admin ID of this map (not set when opened through its writable or read-only ID)
* `name` (string): The name of this map
* `searchEngines` (boolean): Whether search engines may index the read-only version of this map
* `description` (string): The description for search engines
* `clusterMarkers` (boolean): Whether many markers close to each other should be grouped together
* `legend1`, `legend2` (string): Markdown free text to be shown above and below the legend
* `defaultViewId` (number): The ID of the default view (if any)
* `defaultView` ([view](#view)): A copy of the default view object (set by the server)

## View

* `id` (number): The ID of this view
* `name` (string): The name of this view
* `baseLayer` (string): The key of the base layer in this view
* `layers` ([string]): An array of activated overlays in this view
* `top`, `bottom`, `left`, `right`: The [bbox](#bbox) of this view
* `filter` (string): If set, filter the objects according to this filtrex expression

## HistoryEntry

* `id` (number): The ID of this history entry
* `time` (Date): The time when the modification was done
* `type` (string): The type of object that was modified, one of `Marker`, `Line`, `View`, `Type`, `Pad`
* `action` (string): The action that was done, one of `create`, `update`, `delete`
* `objectId` (number): The ID of the object that was modified (null if the object was the map itself)
* `objectBefore` (object): The object before the modification (null if `action` is `create`)
* `objectAfter` (object): The object after the modification (null if `action` is `delete`)

## Type

* `id` (number): The ID of this type
* `name` (string): The name of this type
* `type` (string): `marker` or `line`
* `defaultColour`, `defaultSize`, `defaultSymbol`, `defaultShape`, `defaultWidth`, `defaultMode` (string/number): Default values for the
  different object properties
* `colourFixed`, `sizeFixed`, `symbolFixed`, `shapeFixed`, `widthFixed`, `modeFixed` (boolean): Whether those values are fixed and
  cannot be changed for an individual object
* `fields` ([object]): The form fields for this type. Each field has the following properties:
	* `name` (string): The name of the field. This is at the same time the key in the `data` properties of markers and lines
	* `oldName` (string): When renaming a field (using [`editType(data)`](./methods.md#edittype-data)), specify the former name here
	* `type` (string): The type of field, one of `textarea`, `dropdown`, `checkbox`, `input`
	* `controlColour`, `controlSize`, `controlSymbol`, `controlShape`, `controlWidth` (boolean): If this field is a dropdown, whether the different options set a specific property on the object
	* `default` (string/boolean): The default value of this field
	* `options` ([object]): If this field is a dropdown or a checkbox, an array of objects with the following properties. For a checkbox, the array has to have 2 items, the first representing the unchecked and the second the checked state.
		* `value` (string): The value of this option.
		* `oldValue` (string): When renaming a dropdown option (using [`editType(data)`](./methods.md#edittype-data)), specify the former value here
		* `colour`, `size`, `shape`, `symbol`, `width` (string/number): The property value if this field controls that property

## SearchResult

* `short_name` (string): Name of the result
* `display_name` (string): Name with address
* `address` (string): Only the address
* `boundingbox` ([bbox](#bbox)): bbox that has a good view onto the result. Might be null if `zoom` is set.
* `lat`, `lon` (number): Position of the search result.
* `zoom` (number): Zoom level at which there is a good view onto the result. Might be null if `boundingbox` is set.
* `extratags` (object): Extra OSM tags that might be useful
* `geojson` (object): GeoJSON if the result has a shape
* `icon` (string): Symbol key of the result
* `type` (string): Type of the result
* `id` (string): If the result is an OSM object, the ID of the OSM object, prefixed by `n` (node), `w` (way) or `r` (relation)
* `ele` (number): Elevation in meters

## Route

* `routePoints` (array): Array of route points (objects with `lon` and `lat` properties)
* `mode` (string): Route mode: `"car"`, `"bicycle"`, `"pedestrian"` or an empty string `""` for a direct line
* `trackPoints` (array): An array of [track points](#trackpoint) (objects with a `lon`, `lat`, `ele`, `idx` property and also a `zoom`
  property that indicates from which zoom level the track point should be shown (to avoid an unnecessarily high resolution))
* `distance` (number): The distance of the route in kilometers
* `time` (number): The time it takes to travel the route in seconds
* `ascent` (number): The total meters of climb
* `descent` (number): The total meters of drop
* `left`, `top`, `right`, `bottom` (number): The bounding box of the line (set by the server)
* `routeId` (string): Some methods allow specifying a custom string here to identify the route. This allows having multiple active routes per connection.

## RouteMode

The route mode is a string that describes for what type of transportation a route should be calculated. The following route modes are available:
* (empty string), aliases `helicopter`, `straight`: Go in a straight line
* `pedestrian`, aliases `foot`, `walk`, `walking`: Go by foot
* `bicycle`, alias `bike`: Go by bicycle
* `car`: Go by car
* `track`: Special route mode for lines, indicates that the line is a track imported from a file, not a calculated route.

To use advanced routing settings, additional keywords can be appended to the route mode, separated by a space:
* `hgv`: HGV (truck) routing (in combination with `car`)
* `road`, `mountain`, `electric`: type of bicycle (in combination with `bicycle`).
* `hiking`, `wheelchair`: type of pedestrian (in combination with `pedestrian`).
* `fastest`, `shortest`: Use this routing preference.
* `details`: Load route details (elevation profile, extra info).
* `highways`, `tollways`, `ferries`, `fords`, `steps`: Avoid these.
* `avoid`: Has no effect, but can be inserted in front of the avoidance types to make the route mode more readable.

An example advanced route mode would be `pedestrian wheelchair details avoid steps fords`. Any unknown words inside the route mode should be ignored (they may be options that used to be available in the past).