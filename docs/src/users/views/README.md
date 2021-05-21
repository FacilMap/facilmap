# Saved views

Saved views represent a particular section of the map with a certain [map style](../layers/) and optionally a [filter](../filter/) active. Users can open a view by using the “Views” menu in the [toolbox](../ui/#toolbox) or by opening a [shared link](#share-a-link) to a view. A map can have a [default view](#default-view) that is initially loaded when users open the map.

## Save a view

To save a view, you must have the map open through its [admin link](../collaborative/#urls). In the [toolbox](../ui/#toolbox), click “Views” and then “Save current view”.

The view will persist the section of the map that you are currently viewing and the [map style](../layers/) (base layers and overlays) that is currently active. If some types of [POIs](../pois/) are currently loaded, you can include those in the view by checking the checkbox. If a [filter](../filter/) is currently active, there is another checkbox to include that filter as part of the view or not.

Saving a view does not directly affect any other users who are looking at the map. Views have to be manually opened, or, in case of the [default view](#default-view), are opened when the user initially opens a map.

Be aware that different users have different screen sizes and orientations, so when they open the view, the map might use a different zoom level so that it can fit the same map section.

## Open a view

To open a view, click on “Views” in the [toolbox](../ui/#toolbox) and click on a view. The map will automatically zoom to the section of the view and apply the map style and filter that is part of the view.

## Default view

By default, when opening a collaborative map, FacilMap tries to guess the user’s rough location based on their IP address and shows that area, or the whole world if a guess cannot be made. By setting a default view, the initial view will be the same for all users, regardless of their location.

To save a view as the default, in the [toolbox](../ui/#toolbox) click on “Views” and then “Save current view”. In the dialog, check “Make default view”.

To make an existing view the default, click “Views” and then “Manage views”. In the dialog, you can use the “Make default” button. The current default view is highlighted in bold.

Be aware that the default view is only applied when the map is opened through a link that has no position already implied in its [location hash](../hash/). For example, opening `https://facilmap.org/my-map` will open the default view, but `https://facilmap.org/my-map#6/53.508/8.284/Mpnk` will open the position indicated in the URL.

## Share a link

Shared links to a view have the format `https://facilmap.org/my-map#q=v123`, where `123` is the ID of the view. Opening such a link will directly open the view.

To get the link for a view, [open the view](#open-a-view) and then simply copy the URL from the address bar of your browser.