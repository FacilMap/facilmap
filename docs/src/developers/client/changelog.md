# Changelog

The websocket on the FacilMap server provides different API versions (implemented as socket.io namespaces such as `/` for version 1, `/v2` for version 2, etc.) in order to stay backwards compatible with older clients. Each release of facilmap-client is adapted to a particular API version of the server. When upgrading to a new version of the client, have a look at this page to find out what has changed.

## v5.0.0 (API v3)

* “symbol” was renamed to “icon” everywhere. This applies to `Marker.symbol`, `Type.defaultSymbol`, `Type.symbolFixed`, `Type.fields[].controlSymbol` and `Type.fields[].options[].symbol`.
* “pad” was renamed “map” everywhere. This applies to the `padData` and `deletePad` socket events and `getPad` (including its `padId` request property), `findPads`, `createPad`, `editPad`, `deletePad`, `setPadId` client/socket methods.

## v4.0.0 (API v2)

* Before, creating a map with an empty name resulted in `padData.name` set to `"Unnamed map"`. Now, an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.
* Before, creating a marker with an empty name resulted in `marker.name` set to `"Untitled marker"`. Now an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.
* Before, creating a line with an empty name resulted in `line.name` set to `"Untitled line"`. Now an empty name will result in `""` and the UI is responsible for displaying that in an appropriate way.