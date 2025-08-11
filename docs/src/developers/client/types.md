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
* `own` (boolean, only read): Whether the marker was created by your identity (see [MapSlug](#mapslug))
* `lat` (number, min: -90, max: 90): The latitude of this marker
* `lon` (number, min: -180, max: 180): The longitude of this marker
* `typeId` (number): The ID of the type of this marker
* `name` (string): The name of this marker
* `icon` (string): The icon name for the marker. Default is an empty string.
* `shape` (string): The shape name for the marker. Default is an empty string (equivalent to `"drop"`).
* `colour` (string): The colour of this marker as a 6-digit hex value, for example `ff0000`
* `size` (number, min: 15): The height of the marker in pixels
* `data` (`Record<number, string>`): The filled out form fields of the marker, keyed by field ID.
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
* `own` (boolean, only read): Whether the line was created by your identity (see [MapSlug](#mapslug))
* `routePoints` (`Array<{ lat: number; lon: number }>`, minimum length 2): The route points
* `typeId` (number): The ID of the type of this line
* `name` (string): The name of the line
* `mode` (string): The routing mode, see [route mode](#route-mode)
* `colour` (string): The colour of this line as a 6-digit hex value, for example `0000ff`
* `width` (number, min: 1): The width of the line
* `stroke` (string): The stroke style of the line, an empty string for solid or `dashed` or `dotted`.
* `data` (`Record<number, string>`): The filled out form fields of the line, keyed by field ID.
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

## MapSlug

Where an API method expects a map slug as a parameter, this can be a `string` or an object of the shape `{ mapSlug: string; password?: string; identity?: string | string[] }`. The map slug string can be a slug that is configured for a [map link](#maplink) or a [map token](./advanced.md#map-slugs-tokens-and-passwords).

For the REST API, the password must be provided instead using basic authentication (see [password-protected maps](./advanced.md#password-protected-maps)), and the identity as the `identity` query parameter.

Where an API method returns a map slug or a socket event contains one, it is always a string that represents the map slug that was used to access the map, which can either be the slug of a map link or a map token.

Attempting to access a password-protected map link without providing a or the right password will result in an error that has a `status: 401` property (or in HTTP status 401 when using the REST API).

The `identity` property identifies you as the creator of a map object or history entry. When you provide it, it will be persisted on all markers, lines and history entries that you create, and markers and lines whose creator identity matches yours will be returned with an `own: true` property. Some map links may be configured to only see or modify your markers/lines created by you. To interact with such markers/lines, providing an `identity` is required. What string you use as `identity` is up to you, but one suggestion is to create it using `btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replaceAll("+", "-").replaceAll("/", "_")` (or `createIdentity()` exported by `facilmap-utils`) and to persist (for example in local storage) it as soon as the first change to the map is made.

You can also provide an array of identities. This is meant for cases where multiple devices/storages are merged and one user should be able to edit markers/lines created by multiple identities. When multiple identites are provided, the `own` property is true if the marker/line was created by any of them. When updating/deleting a marker/line owned by one of the identities, that identity is used, otherwise the first identity in the array will be used for any modifications. In the REST API, you can provide multiple identities by specifying the `identity` query parameter multiple times.

## MapData

* `id` (number, only read): The ID of this map. This is used as an internal immutable identifier of the map. You cannot find a map using its ID, only using one of its map slugs.
* `name` (string): The name of this map
* `description` (string): The description for search engines
* `clusterMarkers` (boolean): Whether many markers close to each other should be grouped together
* `legend1`, `legend2` (string): Markdown free text to be shown above and below the legend
* `links` (<code>Array&lt;[MapLink](#maplink)&gt;</code>): The map links configured for this map. At least one link with `admin` permissions needs to be configured. Map links with higher permissions than the map link through which the map was opened are hidden. If the map was opened through a [map token](./advanced.md#map-slugs-tokens-and-passwords), the `links` array is empty.
* `activeLink` (<code>[MapLink](#maplink)</code>, only read): The map link through which the map was opened. If the map was opened using a [map token](./advanced.md#map-slugs-tokens-and-passwords), this contains a virtual map link that does not have an ID and is not present in the `links` property.
* `defaultViewId` (number): The ID of the default view (if any)
* `defaultView` ([View](#view), only read): A copy of the default view object (set by the server)
* `createDefaultTypes` (boolean, only create): On creation of a map, set this to false to not create one marker and one line type.

## MapLink

Represents a URL through which a map can be opened. Each map can have one or more links configured. At least one of them must have the `admin` permission.

* `id` (number, only read/update): The internal ID of the map link. This is automatically created when the map link is first created. When changing an existing map link, keep its ID so that the server can identify which map link you have changed. On `mapData.mapLink`, this property is absent when the map was opened using a map token rather than a map slug.
* `slug` (string): The map slug of the map link. This is the last part of the URL that can be used to open the map, and it is also used in the API to reference the map. The map slug must be unique to a specific map. However, one map may have multiple links with the same slug if they all have a password and those passwords are all different.
* `password` (create: `false | string`, read: `boolean`, update: `boolean | string`): Set this to a password to require this password when opening the map through this link. Set it to `false` to require no password. When reading the map data of a map, `true` indicates that a password is set. Then updating a map, `true` indicates that the existing password will keep the existing password unchanged (will fail if there is no existing password).
* `permissions` (<code>[MapPermissions](#mappermissions)</code>): The permissions that will be given when opening the map through this link.
* `searchEngines` (boolean): If this is true, this map link will be published and search engines (such as Google) will be allowed to index it. It will also be findable through the “Open map” dialog.

## MapPermissions

* `read` (`boolean | "own"`): Whether users can see types, markers and lines that are not explicitly listed in the `types` property. If set to `"own"`, users can see all types, but see only markers and lines that they have personally created.
* `update` (`boolean | "own"`): Whether users can create/edit/delete markers and lines whose types are not explicitly listed in the `types` property. if set to `"own"`, users can only edit/delete markers and lines that they have personally created.
* `settings` (boolean): Whether users can edit the map settings (except map links) and create/edit/delete types and views, with the exception of types that they cannot see because they are hidden by the `types` property or some of whose fields they cannot read or update.
* `admin` (boolean): Whether users can edit the map links and delete the map.
* `types` (object, optional): An object that overrides the `read` and `update` permission for individual types. It is a record that maps the type ID to an object of the following shape:
	* `read` (`boolean | "own"`): Whether users can see the type itself and markers/lines of the type. If set to `"own"`, users can see the type but only see markers/lines that they have personally created. The visibility of individual fields can be overridden using the `fields` property, but this permission always applies to marker/line attributes such as position, route mode and style.
	* `update` (`boolean | "own"`): Whether users can create/edit/delete markers/lines of this type. If set to `"own"`, they can only edit/delete markers/lines that they have personally created. The editability of individual fields can be overridden using the `fields` property, but this permission always applies to marker/line attributes such as position, route mode and style.
	* `fields` (object, optional): An object that overrides the `read` and `update` permission for individual fields. This only applies to custom data fields, not to data attributes such as the marker position, route mode or object style. A record that maps the field ID to an object of the following shape:
		* `read` (`boolean | "own"`): Whether users can see this field for markers/lines of this type. If set to `"own"`, they can only see it on markers/lines that they have personally created.
		* `update` (`boolean | "own"`): Whether users can edit this field for markers/lines of this type. If set to `"own"`, they can only edit it on markers/lines that they have personally created.

Within the hierarchy of `admin` &gt; `settings` &gt; `update` &gt; `read` and `true` &gt; `"own"` &gt; `false`, permissions of a lower level must always be given if a higher level permission is given. For example, it is not possible to give update permission without giving read permission. The only exception is that the `types` object can apply more restrictive permissions to individual types than what the general permissions allow, and the `field` object can apply more restrictive permissions to individual fields than the type permissions allow. If `admin` permission is given, no `types` must be present.

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
	* `id` (number, only read/update): The unique immutable identifier of the field. This is also used as the key in the `data` properties of markers and lines. When you update a type, omit this to create a new field (the server will assign an ID) or specify it to update an existing field. If an ID is not present anymore in the list of fields, that field will be deleted.
	* `name` (string): The name of the field. The name must be unique, no two fields in the same type may have the same name. Note that the if the name is "Description", the FacilMap UI will translate the name to other languages even though the underlying name is in English.
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