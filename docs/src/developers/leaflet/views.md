# Views

Views in FacilMap are a particular bounding box on the map, with a particular set of layers visible and possibly an active filter. Views can be saved as part of collaborative maps. More details can be found in the [User guide](../../users/views/).

A view object represents a view. Its shape is documented in the [Client API](../client/types#view). Note that only objects that represent saved views will have an `id`.


## Current view

`getCurrentView(map, includeFilter)` returns a view object that represents the current view of the map. If `includeFilter` is `true`, the current [filter](./filter) is included in the object (if there is one), otherwise it is omitted.

`isAtView(map, view)` returns a boolean that indicates whether the current map view is equal to the view represented by the specified view object. If the `view` object is omitted, the method will indicate whether the current map shows the fallback view (the whole world).


## Show a view

`displayView(map, view)` will animate the map to fly to the specified view and activate the layers and filter specified in the view object. If the `view` object is omitted, the map will show the fallback view (the whole world).


## Initial view

`getInitialView(client)` returns a promise that is resolved with one of the following, in order:
* If a collaborative map is open and a default view is configured, that view is returned.
* Otherwise, an attempt is made to guess the position of the user using [geoip](../client/methods#geoip). If a guess could be made, a view object representing the rough area is returned.
* Otherwise, `undefined` is returned.

Here is an example how the initial view could be set:
```javascript
import L from "leaflet";
import Client from "facilmap-client";
import { displayView, getInitialView } from "facilmap-leaflet";

const map = L.map('map');
const client = new Client("https://facilmap.org/", "myMapId");
displayView(map, await getInitialView(this.client));
```