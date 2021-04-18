# Filter

Filter expressions in FacilMap can be used to show/hide markers and lines on collaborative maps based on certain criteria. More information can be found in the [User guide](../../users/filter/).

facilmap-leaflet injects the following properties and methods into [Leaflet map](https://leafletjs.com/reference.html#map) objects to use filters:
* `setFmFilter(filter)`: Set the current filter expression. `filter` is a string with the filter expression or `undefined`. An exception is thrown if the filter expression is invalid.
* `fmFilter`: The current filter expression (string or undefined).
* `fmFilterFunc(object, type)`: Returns a boolean that indicates whether the specified object matches the current filter. `object` can be a [Marker](../client/types#marker) or [Line](../client/types#line), and `type` is its [Type](../client/types#type).

When the filter is updated using `setFmFilter()`, the map fires an `fmFilter` event. Other FacilMap Leaflet components ([`MarkersLayer`](./markers), [`LinesLayer`](./lines), [`HashHandler`](./hash)) react to this event and update their state accordingly.