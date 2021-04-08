# Map point information

By pressing a specific point on the map and holding the mouse/finger for a second, you can find out more information about that point. A temporary marker appears on the map and a [search box](../ui/#search-box) tab with information about the place is opened.

The information that is shown comes from [Nominatim](https://nominatim.openstreetmap.org/) and depends on the zoom level. If you long-click a point while the map is at a low zoom level, it might show information about the country or state. At a medium zoom level, it will show information about the city or county and at high zoom levels, it might show information about the street or the building that you clicked on.

The marker and search box tab will disappear again when you click somewhere else on the map or when you close the search box tab using the X icon. If you want to persist the marker or add multiple ones, start a [collaborative map](../collaborative/) and add the markers there.

At the bottom of the search box tab, you will find a “Use as” button to [use the map point as a route destination](../route/#use-map-points-as-destinations). If a collaborative map is open, you can use the “Add to map” button to add the point as a marker to the map (which will automatically prefill some fields).

<Screencast :desktop="require('./marker.mp4')" :mobile="require('./marker-mobile.mp4')"></Screencast>

## Share a link

FacilMap continuously updates the location hash (the part after the `#` in the address bar of your browser) to represent what you currently view on the map. More information can be found under [Share a link](../hash/).

When you long-click the map to open the map point information, this is also persisted in the location hash. This means that you can use the URL straight from the browser address bar to share a link to a specific map point.

Links to a map point will have the following format:
* [`https://facilmap.org/#q=geo%3A52.52291%2C13.41431%3Fz%3D7`](https://facilmap.org/#q=geo%3A52.52291%2C13.41431%3Fz%3D7): Open the map point at coordinates 52.52291,13.41431 and zoom level 7
* [`https://facilmap.org/#10/52.5200/13.3374/Mpnk/geo%3A52.52291%2C13.41431%3Fz%3D7`](https://facilmap.org/#10/52.5200/13.3374/Mpnk/geo%3A52.52291%2C13.41431%3Fz%3D7): Open the map point at coordinates 52.52291,13.41431 and zoom level 7, but centre the map at coordinates 52.5200,13.3374 and zoom level 10.