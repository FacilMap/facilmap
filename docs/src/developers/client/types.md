# Types

The [facilmap-types](https://www.npmjs.com/package/facilmap-types) package contains TypeScript typings for all the basic types used by the different components of FacilMap. Using TypeScript can be helpful to get some assistance what kind of properties an object provides and expects.

Many types accept an optional `CRU` (CRUD without delete) generic that can be set to `CRU.CREATE`, `CRU.READ`, `CRU.UPDATE` (defaults to `CRU.READ`) that will make certain properties optional/required or available/unavailable depening on whether you’re creating or updating the object or reading an existing one. Generally, in update mode most properties are optional; this is not explicitly documented on this page.

For most types a [zod](https://github.com/colinhacks/zod) validator is also exported (for example, for type `Marker` the validator would be called `markerValidator`). For CRU types, the validator is an object whose `create`, `read` and `update` properties contain the actual validators.

## `Bbox`

A bounding box that describes which part of the map the user is currently viewing.

* `top` (number, min: -90, max: 90): The latitude of the north end of the box
* `bottom` (number, min: -90, max: 90): The latitude of the south end of the box
* `left` (number, min: -180, max: 180): The longitude of the west end of the box
* `right` (number, min: -180, max: 180): The longitude of the east end of the box
* `zoom` (number, min: 1, max: 20): The current zoom level. This is relevant for the density of track points that should be received.

## `BboxWithExcept`

A bounding box that may include another bounding box as “except”. This can be used when panning the map – the map objects for the new bbox should be retrieved, except map objects in the previous bbox, because they were already received in the previous request.

* All properties of [`Bbox`](#bbox)
* `except` ([`Bbox`](#bbox), optional): The bbox to exclude

## `Marker`

* `id` (number, only read): The ID of this marker
* `mapId` (number, only read): The ID of the map the marker belongs to
* `lat` (number, min: -90, max: 90): The latitude of this marker
* `lon` (number, min: -180, max: 180): The longitude of this marker
* `typeId` (number): The ID of the type of this marker
* `name` (string): The name of this marker
* `icon` (string): The icon name for the marker. Default is an empty string.
* `shape` (string): The shape name for the marker. Default is an empty string (equivalent to `"drop"`).
* `colour` (string): The colour of this marker as a 6-digit hex value, for example `ff0000`
* `size` (number, min: 15): The height of the marker in pixels
* `data` (`Record<string, string>`): The filled out form fields of the marker, keyed by field name. A null-prototype object should always be used for this to avoid prototype pollution.
* `ele` (number or null): The elevation of this marker in metres (calculated by the server if not set)

## `Line`

Each line has route points and track points. The route points are the start, end and via points that the user has set
for that line, the track points describe how the line should be drawn. If no routing is used, the route points and
track points are equal, but with routing, there will be a lot more track points than route points.

When creating or updating a line, the track points, distance and time are automatically calculated by
the server. Only when the routing mode is `track`, the `trackPoints` can be specified by hand (meant for importing
existing tracks, for example from a GPX file). The `idx`, `zoom` and `ele` properties of the track points are added by
the server automatically.

Note that `Line` objects coming from the server don’t contain the `trackPoints` property (unless you are explicitly retrieving the `linesWithTrackPoints` object type), but the track points are sent separately through `linePoints` events.

* `id` (number, only read): The ID of this line
* `mapId` (number, only read): The ID of the map that the line belongs to
* `routePoints` (`Array<{ lat: number; lon: number }>`, minimum length 2): The route points
* `typeId` (number): The ID of the type of this line
* `name` (string): The name of the line
* `mode` (string): The routing mode, see [route mode](#route-mode)
* `colour` (string): The colour of this marker as a 6-digit hex value, for example `0000ff`
* `width` (number, min: 1): The width of the line
* `stroke` (string): The stroke style of the line, an empty string for solid or `dashed` or `dotted`.
* `data` (`Record<string, string>`): The filled out form fields of the line, keyed by field name. Null-prototype objects should always be used for this to avoid prototype pollution.
* `left`, `top`, `right`, `bottom` (number, only read): The bounding box of the line (set by the server)
* `distance` (number, only read): The distance of the line in kilometers (set by the server)
* `ascent`, `descent` (number or undefined, only read): The total ascent/descent of the line in metres (set by the server if enabled in route mode)
* `time` (number or undefined): The time it takes to travel the route in seconds (only if routing is enabled) (set by the server)
* `extraInfo` ([`ExtraInfo`](#extrainfo)): Extra details about the route (set by the server).
* `trackPoints` (`Array<{ lat: number; lon: number; ele?: number }>`, only create/update): The track points to set for the line. Only used when `mode` is `track`.

## `TrackPoint`

All track points have a `zoom` level and are only received when the zoom level of the current bbox is at least that
level. This makes sure that at a small zoom level, only a low resolution of the line has to be downloaded. When zooming
in, only the additional track points are retrieved. They can be merged into the already retrieved track points using
their `idx` property.

* `idx` (number): The index of this track point in the list of all track points of this line
* `lat` (number, min: -90, max: 90): The latitude of this point
* `lon` (number, min: -180, max: 180): The longitude of this point
* `zoom` (number, min: 1, max: 20): The miminum zoom level from which this track point makes sense to show
* `ele` (number or undefined): The elevation of this track point in metres.

## MapData

* `id` (number, only read): The ID of this map. This is used as an internal immutable identifier of the map. You cannot find a map using its ID, only using one of its map slugs.
* `readId` (string): The read-only map slug of this map
* `writeId` (string): The read-write map slug of this map
* `adminId` (string): The admin map slug of this map
* `name` (string): The name of this map
* `searchEngines` (boolean): Whether search engines may index the read-only version of this map
* `description` (string): The description for search engines
* `clusterMarkers` (boolean): Whether many markers close to each other should be grouped together
* `legend1`, `legend2` (string): Markdown free text to be shown above and below the legend
* `defaultViewId` (number): The ID of the default view (if any)
* `defaultView` ([View](#view), only read): A copy of the default view object (set by the server)
* `createDefaultTypes` (boolean, only create): On creation of a map, set this to false to not create one marker and one line type.

## MapDataWithWritable

This is a variation of [`MapData`](#mapdata) with the following differences:
* `writeId` is only set if the map was opened with its write slug or admin slug
* `adminId` is only set if the map was opened with its admin slug
* `writable` (`Writable`, only read): `Writable.READ` (`0`) if the map was opened using its read-only slug, `Writable.WRITE` (`1`) if it was opened using its read-write slug, `Writable.ADMIN` (`2`) if it was opened using its admin slug.

## View

* `id` (number, only read): The ID of this view
* `mapId` (number, only read): The map ID that the view belongs to
* `name` (string): The name of this view
* `idx` (number): The sorting position of this view. When a list of views is shown to the user, it should be ordered by this value (higher numbers further down). If views were deleted or reordered, there may be gaps in the sequence of indexes, but no two views on the same map can ever have the same index. When setting this as part of a view creation/update, other views with a same/higher index will have their index increased to be moved down the list.
* `baseLayer` (string): The key of the base layer in this view
* `layers` (string): An array of activated overlays in this view
* `top`, `bottom`, `left`, `right`: The [bbox](#bbox) of this view
* `filter` (string): If set, filter the objects according to this filtrex expression

## Type

* `id` (number, only read): The ID of this type
* `type` (string, only create/read): `marker` or `line`
* `mapId` (number, only read): The ID of the map that the type belongs to
* `name` (string): The name of this type. Note that the if the name is "Marker" or "Line", the FacilMap UI will translate the name to other languages even though the underlying name is in English.
* `idx` (number): The sorting position of this type. When a list of types is shown to the user, it should be ordered by this value (higher numbers further down). If types were deleted or reordered, there may be gaps in the sequence of indexes, but no two types on the same map can ever have the same index. When setting this as part of a type creation/update, other types with a same/higher index will have their index increased to be moved down the list.
* `defaultColour`, `defaultSize`, `defaultIcon`, `defaultShape`, `defaultWidth`, `defaultStroke`, `defaultMode` (string/number): Default values for the different object properties
* `colourFixed`, `sizeFixed`, `iconFixed`, `shapeFixed`, `widthFixed`, `strokeFixed`, `modeFixed` (boolean): Whether those values are fixed and cannot be changed for an individual object. Setting this to true will modify all the objects of this type and fix the value.
* `showInLegend` (boolean): Whether this type should be shown in the map legend.
* `fields` (Array): The form fields for this type. Each field has the following properties:
	* `name` (string): The name of the field. This is at the same time the key in the `data` properties of markers and lines. The name must be unique, no two fields in the same type may have the same name. Note that the if the name is "Description", the FacilMap UI will translate the name to other languages even though the underlying name is in English.
	* `oldName` (string, only update): When renaming a field (using [`updateType()`](./methods.md#updatetype)), specify the former name here. Renaming a field will modify all the objects of this type to rename the field in their data.
	* `type` (string): The type of field, one of `textarea`, `dropdown`, `checkbox`, `input`
	* `controlColour`, `controlSize`, `controlIcon`, `controlShape`, `controlWidth`, `controlStroke` (boolean): If this field is a dropdown or checkbox, whether the different options set a specific property on the object
	* `showInLegend` (boolean): If this field is a dropdown or checkbox, whether items for its options should be shown in the legend. Only has an effect if the type itself is shown in the legend. If set to undefined, it is shown in the legend only if the field controls the colour, marker icon or shape, or line width or stroke.
	* `default` (string/boolean): The default value of this field
	* `options` (Array): If this field is a dropdown or a checkbox, an array of objects with the following properties. For a checkbox, the array has to have 2 items, the first representing the unchecked and the second the checked state.
		* `value` (string): The value of this option.
		* `oldValue` (string, only update): When renaming a dropdown option (using [`updateType()`](./methods.md#updatettype)), specify the former value here. Renaming a dropdown option will modify the objects of this type to rename the value.
		* `colour`, `size`, `shape`, `icon`, `width`, `stroke` (string/number): The property value if this field controls that property

## HistoryEntry

* `id` (number): The ID of this history entry
* `mapId` (number): The map ID that the history entry belongs to
* `time` (Date): The time when the modification was done
* `type` (string): The type of object that was modified, one of `Marker`, `Line`, `View`, `Type`, `Pad`
* `action` (string): The action that was done, one of `create`, `update`, `delete`
* `objectId` (number): The ID of the object that was modified (undefined if the object was the map itself)
* `objectBefore` (object): The object before the modification (undefined if `action` is `create`)
* `objectAfter` (object): The object after the modification (undefined if `action` is `delete`)

## SearchResult

* `short_name` (string): Name of the result
* `display_name` (string): Name with address
* `address` (string): Only the address
* `boundingbox` ([bbox](#bbox)): bbox that has a good view onto the result. Might be null if `zoom` is set.
* `lat`, `lon` (number): Position of the search result.
* `zoom` (number): Zoom level at which there is a good view onto the result. Might be null if `boundingbox` is set.
* `extratags` (object): Extra OSM tags that might be useful
* `geojson` (object): GeoJSON if the result has a shape
* `icon` (string): Icon key of the result
* `type` (string): Type of the result
* `id` (string): If the result is an OSM object, the ID of the OSM object, prefixed by `n` (node), `w` (way) or `r` (relation)
* `ele` (number): Elevation in meters

## Route

* `routePoints` (`Array<{ lat: number; lon: number }>`): Array of route points
* `mode` (string): See [route mode](#route-mode)
* `distance` (number): The distance of the route in kilometers
* `time` (number or undefined): The time it takes to travel the route in seconds
* `ascent` (number or undefined): The total meters of climb
* `descent` (number or undefined): The total meters of drop
* `left`, `top`, `right`, `bottom` (number): The bounding box of the line

## Route mode

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

## `ExtraInfo`

Type: `Record<string, [from: number, to: number, type: number]>`

When `details` is enabled in the [route mode](#route-mode), this data type is used to represent the route details. The value is returned by [OpenRouteService](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/extra-info/#extra-info-in-responses).

The key represents an attribute (such as surface or steepness). In the value tuple, the first value is the start track point index of a section, the second value the end index and the third value is the actual value of the attribute, encoded as a number. The keys and values are not very well documented, but you may look at the source code of [Leaflet.Heightgraph](https://github.com/GIScience/Leaflet.Heightgraph/blob/master/example/mappings.js) and FacilMap’s [Heightgraph](https://github.com/FacilMap/facilmap/blob/main/frontend/src/lib/utils/heightgraph.ts) control to get an idea what the values mean.

## `Paging`

Some API endpoints will return only a part of the the available data to avoid consuming too many resources. You can control which part of the data is returned by providing these properties:

* `start` (number, optional, min 0): The index of the first item to be returned (starting at 0). Defaults to 0.
* `limit` (number, optional, min 1, max 200): The number of items to return. Defaults to 50.

## `PagedResults`

API endpoints using [paging](#paging) will return their results in the form of an object with the following properties:
* `results` (Array): The actual result objects
* `totalLength` (number): The total number of result objects available, to get an indication how many oages there are.

## `AllMapObjectsPick`

Type: `"mapData" | "types" | "views" | "markers" | "lines" | "linesWithTrackPoints" | "linePoints"`

In some API methods you can specify which kind of map data you want to receive.

`lines` refers to lines without their track points. `linePoints` refers to [`linePoints` events](./events.md#linepoints), containing just the track points for a specific line. `linesWithTrackPoints` refers to a combination of both: line objects that have an additional `trackPoints` property containing the track points.