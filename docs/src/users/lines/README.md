# Lines

A line is a connection of two or more points on the map and has a name, a certain style (width, colour) and some data (such as a description). It can be a straight line or a calculated route, depending on its route mode. When you add a line to a map, it is permanently saved there and visible for anyone who is viewing the map.

By default, a collaborative map has one type of line called “Line” that has a description field and whose style can be configured freely. Other types of lines with fixed styles and additional fields can be defined using [custom types](../types/). For simplicity, the descriptions on this page are assuming that you are working with the default “Line” type.

## Draw a line

One way to add a line to a map is to draw it on the map. In the [toolbox](../ui/#toolbox), click “Add” and then “Line”. A message will pop up on the top right of the screen. Now click on the map repeatedly to add more line points. When you are finished, click the “Finish” button in the message and your line will be saved.

When you draw lines, they will always connect their line points using straight lines. You can, however, choose a route mode later in the [line details](#edit-line-details). This means that the line points that you added will become route destinations.

<Screencast :desktop="require('./draw.mp4')" :mobile="require('./draw-mobile.mp4')"></Screencast>

After saving the line, it will be called “Untitled line”, will have the default style and no description. As a next step, you might want to [edit the line details](#edit-line-details) to give it a name and change its style.

## Add a route as a line

Another way to add a line to the map is to calculate a [route](../route/) first and save that as a line. In the [search box](../ui/#search-box) tab of the route, click on “Add to map” and the bottom and then select “Line”.

On the map, the route will still look the same, but it is now saved as a line, as you can see from the fact that a new search box tab appeared for the line details, and the line is not draggable anymore.

<Screencast :desktop="require('./add-route.mp4')" :mobile="require('./add-route-mobile.mp4')"></Screencast>

## Add a search result as a line

Some [search results](../search/) are line or polygons (for example when the result is a street or the boundaries of a city). You can add these as a line to the map. The same procedure can also be used for polylines/polygons that are part of a [geographic file](../files/).

In the search box tab of the search result, click on “Add to map” and then “Line”. The line will be created with the name of the result. If the line is a [custom type](../types/), a mapping from the result info to the line data is attempted, for example if the line has a field “Address”, it will be filled with the address of the result.

<Screencast :desktop="require('./add-result.mp4')" :mobile="require('./add-result-mobile.mp4')"></Screencast>

You can also add multiple results at once. In the search form, select multiple items by using the “Select all” button or clicking individual items while holding the Ctrl or Shift key. Then click “Add selected items to map” and then “Line/polygon items as Line”. (Those selected results that are markers and not lines/polygons will not be added.)

<Screencast :desktop="require('./add-results.mp4')" :mobile="require('./add-results-mobile.mp4')"></Screencast>

## Show line details

When you click on a line, it is highlighted and a [search box](../ui/#search-box) tab appears with the name, coordinates and data (such as description). To close the line details, click on the X on the tab or click somewhere else on the map. This will only hide the line details for you, it will not delete the line.

## Edit line details

To edit the details of a line, select the line and then click “Edit data” in its [search box](../ui/#search-box) tab. A dialog will open where you can edit the following fields:
* **Name:** The name of the line. Will be shown as the heading in the line details and as a tooltip when hovering the line.
* **Routing mode:** The route mode of the line. By default, “straight line” is selected, but you can select something else to make the line points into route destinations. More information about route modes can be found under [routes](../routes/#route-modes).
* **Colour:** The colour of the line.
* **Width:** The width of the line (in pixels). Use the + and &minus; buttons to change the value.
* **Description:** The description of the line. Will be shown in the line details. You can format the text using [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet).

Click “Save” to save your changes.

<Screencast :desktop="require('./edit-details.mp4')" :mobile="require('./edit-details-mobile.mp4')"></Screencast>

## Edit line points

To change the course or the position of a line, select the line and then click “Edit waypoints” in its [search box](../ui/#search-box) tab. A message will appear on the top right of the screen and the tab will turn into a search form and the line will become draggable. You can now change the line in the same way that you would [change a route](../routes/#drag-a-route), by changing the route destinations in the form or by dragging the line. When you are finished, click the “Finish” button in the message.

<Screencast :desktop="require('./drag.mp4')" :mobile="require('./drag-mobile.mp4')"></Screencast>

## Remove a line

To remove a line from the map, select the line, click “Remove” and confirm the alert box. Note that removed lines will remain in the [edit history](../history/) of the map and can be seen and restored there by admins.

<Screencast :desktop="require('./remove.mp4')" :mobile="require('./remove-mobile.mp4')"></Screencast>