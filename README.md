**This is the outdated version 2 of FacilMap. Find the newest version of FacilMap on the [master branch](https://github.com/FacilMap/facilmap) or in the [facilmap/facilmap](https://hub.docker.com/r/facilmap/facilmap) Docker image.**

----

[**FacilMap**](https://facilmap.org/) is an online map that aims to bring together many useful functions in a usable and pretty way onto an
open-source map based on [OpenStreetMap](https://openstreetmap.org/). Features include:

* Different map styles: [OpenMapSurfer](http://korona.geog.uni-heidelberg.de/), [Mapnik](https://openstreetmap.org/),
  [OpenCycleMap](https://opencyclemap.org/), [Hike & Bike map](http://hikebikemap.org/).
* [Public Transportation](http://openptmap.org/) and hillshading overlays.
* Search and calculate routes. Routes are fully draggable. (Uses [Nominatim](http://wiki.openstreetmap.org/wiki/Nominatim),
  [Mapbox](https://www.mapbox.com/api-documentation/#directions), [OSRM](http://project-osrm.org/).)
* Show GPX/KML/OSM/GeoJSON files on the map (use `Tools` → `Import File`, type a URL into the search field, or simply
  drag and drop a file onto the map)
* Show additional information about places (for example opening hours or a link to the website). Press the map for
  1 second somewhere to show information about what is there. (Uses [Nominatim](http://wiki.openstreetmap.org/wiki/Nominatim).)
* Zoom to the location of your device and follow it. (Uses [leaflet-locatecontrol](https://github.com/domoritz/leaflet-locatecontrol).)
* Create a collaborative map under a custom link where you and others can add markers, draw lines, save routes and
  import GPX/KML/OSM/GeoJSON files
    * Every map has two links, a read-only one and one where it can be edited. Everyone who has the link can access the map
      (similar to [Etherpad](http://etherpad.org/), just for maps).
    * Live collaboration. All changes to the map are immediately visible to everyone who is looking at it (using
      [socket.io](http://socket.io/)).
    * Markers and lines can have a name and description, which will be visible in a popup when clicking on it.
    * Custom types of markers and lines can be defined, where in addition to the name and description, more text fields,
      dropdowns and checkboxes can be added to be filled out. Custom dropdown fields can modify the style (colour and width)
      of the markers and lines automatically, and a legend is generated automatically to explain what the different
      styles stand for.
    * The current map view can be saved for others to open.
    * Map objects that do not fit a certain filter expression can be hidden (using [Filtrex](https://github.com/joewalnes/filtrex))
    * There is a modification history and changes can be undone
* Can be easily run on your server or embedded into your website (see below).

On the client side, FacilMap relies heavily on [AngularJS](https://angularjs.org/), [Leaflet](http://leafletjs.com/)
and [Bootstrap](https://getbootstrap.com/). On the server side, it uses [Node.js](https://nodejs.org/),
[Sequelize](http://sequelizejs.com/) and [socket.io](http://socket.io/).


Developer documentation
=======================

* [Embed FacilMap into your website](./frontend/README.md)
* [Run the FacilMap server yourself](./server/README.md)
* [Use the FacilMap client](./client/README.md) to receive changes and add/update/remove objects to/from a FacilMap
  programmatically from a JavaScript web or server application.