# POIs

Using the “POIs” menu in the [search box](../ui/#search-box), you can find amenities and points of interest (POIs) on the map. You can use it for example to show all post boxes, parking places, supermarkets or bus stops in an area.

Choose a category of POIs and then check some of the POI types to show them on the map. Since the list of available POI types is quite long, you can type something into the filter field on top to show only those checkboxes that contain that phrase. For example, if you type “parking” into the filter field, only the “Bicycle parking” and “Parking” checkboxes are shown.

When one or more checkboxes are checked, the POIs of this type are shown as black square markers on the map. Only the POIs in the current map view are loaded, so only when you move to a particular area on the map, the POIs for that area are loaded. A maximum of 50 POIs are loaded. If the current area of the map contains more than 50 POIs of the selected type, a yellow message will be shown on the top of the map (see more details [below](#zoom-limitations)). In that case none or only some of the available POIs are shown. Zoom in further to get a complete overview of POIs.

<Screencast :desktop="require('./pois.mp4')" :mobile="require('./pois-mobile.mp4')"></Screencast>


## Show details

Clicking on a POI marker will open an additional search box tab with some metadata, such as opening hours, access restrictions and contact details. The metadata tab can be closed by clicking on the X or clicking somewhere else on the map.

<Screencast :desktop="require('./metadata.mp4')" :mobile="require('./metadata-mobile.mp4')"></Screencast>


## Zoom limitations

To avoid overloading the server or your browser, a maximum of 50 POIs are shown on the map, and the server may take a maximum of 2 seconds to load them. When the limit is exceeded, a yellow message is shown on the top of the map. There is no fixed minimum zoom level, it depends on the density of POIs in the current map area. The yellow message may say one of the following things:
* “Zoom in to show POIs.” – This is shown when you are zoomed out so far that the server took more than 2 seconds to look for POIs. To avoid overloading the server, the request was canceled and no POIs are shown.
* “Not all POIs are shown because there are too many results. Zoom in to show all results.” – This means that the server found more than 50 POIs. To save resources, only the first 50 POIs found are shown on the map. This means that the results shown are not all that exist. To get a complete overview of the existing POIs, zoom in further.

<Screencast :desktop="require('./zoom.mp4')" :mobile="require('./zoom-mobile.mp4')"></Screencast>


## Share a link

When you enable POIs on the map, the types of POIs that you checked are stored in the [location hash](../share/). To share a link to a specific part of the map with specific types of POIs shown, simply navigate the map to that view and copy the URL from the address bar of your browser.

On collaborative maps, POI types can also be saved and shared as part of [saved views](../views/).


## Custom query

FacilMap uses the [Overpass API](https://overpass-api.de/) to query the OpenStreetMap database for POIs. If the available types of POIs do not fulfill your needs, you can click the “Custom query” button at the bottom of the POI tab and type a custom query into the text field. The query will be applied automatically, there is no save button or something like that.

The custom query field only expects a [query statement](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#The_Query_Statement), without any other Overpass commands. FacilMap will automatically enrich the query so that it searches only in the current map area and there is a limit of 50 results. The results will always be shown as markers. If a query returns OpenStreetMap ways or relations, the marker will be rendered at their geometric centre.

The Overpass API queries the OpenStreetMap database for objects based on their tags. An overview over the most common tags can be found [on the OpenStreetMap wiki](https://wiki.openstreetmap.org/wiki/Map_features).

Here are some example queries:
* `nwr[amenity=parking]`: Parking places.
* `(nwr[amenity=toilets]; -nwr[amenity=toilets][fee][fee!=no];)`: Toilets without a fee.
* `(nwr[amenity=post_box]; nwr[amenity=post_office];)`: Post boxes and post offices.
* `nwr[amenity=drinking_water][drinking_water=yes]`: Water fountains that are explicity marked as drinkable.