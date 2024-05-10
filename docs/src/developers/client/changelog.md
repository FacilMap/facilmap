# Changelog

The websocket on the FacilMap server provides different API versions (implemented as socket.io namespaces such as `/` for version 1, `/v2` for version 2, etc.) in order to stay backwards compatible with older clients. Each release of facilmap-client is adapted to a particular API version of the server. When upgrading to a new version of the client, have a look at this page to find out what has changed.

## v5.0.0 (API v3)

_Note: This socket version is still under development and will still change. Do not use it in production yet._

* “symbol” was renamed to “icon” everywhere. This applies to `Marker.symbol`, `Type.defaultSymbol`, `Type.symbolFixed`, `Type.fields[].controlSymbol` and `Type.fields[].options[].symbol`.
* “pad” was renamed “map” everywhere. This applies to the `padData` and `deletePad` socket events and `getPad` (including its `padId` request property), the `findPads`, `createPad`, `editPad`, `deletePad`, `setPadId` client/socket methods, the `PadNotFoundError`, and the `Marker.padId`, `Line.padId`, `Type.padId`, `View.padId` and `HistoryEntry.padId` properties.
* “padId” (the unique string that is part of a shareable map link) is now called “mapSlug” throughout the code base. “mapId” now refers to the internal ID of a map.
* The socket client provides the same API methods as the new REST client. This means that a map slug now needs to be specified for all methods (there is no “active” map anymore), in particular `updateMap`, `deleteMap`, `revertHistoryEntry`, `getMarker`, `createMarker`, `updateMarker`, `deleteMarker`, `createLine`, `updateLine`, `deleteLine`
* A few method signatures have been changed:
	* `findPads({ query, start, limit })` was changed to `findMaps(query, { start, limit })`
	* `getPad({ padId })` was changed to `getMap(mapSlug)` and now returns the full map data
	* `createPad(padData)` was changed to `createMap(padData, { pick?, bbox? })`. It now returns a `{ results: stream }` of map object tuples rather than an object of map events.
	* `find({ query, loadUrls? })` has been split up into `find(query)` and `findUrl(url)`. Use `parseUrlQuery(query)` from `facilmap-utils` to check whether a search query is a URL (if it returns a string, it is).
	* `findOnMap({ query })` has been changed to `findOnMap(query)`.
* A few methods have been renamed:
	* `add*` has been renamed to `create*` (`addMarker`, `addLine`, `addType`, `addView`)
	* `edit*` has been renamed to `update*` (`editPad`, `editMarker`, `editLine`, `editType`, `editView`)
* `getLineTemplate()` has been removed. Use `getLineTemplate(type)` from `facilmap-utils` instead.


## v4.0.0 (API v2)

* Before, creating a map with an empty name resulted in `padData.name` set to `"Unnamed map"`. Now, an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.
* Before, creating a marker with an empty name resulted in `marker.name` set to `"Untitled marker"`. Now an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.
* Before, creating a line with an empty name resulted in `line.name` set to `"Untitled line"`. Now an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.