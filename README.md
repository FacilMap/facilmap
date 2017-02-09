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
      [socket.io](http://socket.io/).
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
and [Bootstrap](https://getbootstrap.com/). On the server side, it uses [https://nodejs.org/](Node.js),
[Sequelize](http://sequelizejs.com/) and [socket.io](http://socket.io/).


Embedding into a website
========================

Using an iframe
---------------

It is perfectly fine to embed a map from [facilmap.org](https://facilmap.org/) into an iframe.

```html
<iframe style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap"></iframe>
```

Directly into a page
--------------------

Include [`all.js`](https://facilmap.org/all.js) and [`all.css`](https://facilmap.org/all.css) (which includes all
dependencies) or [`app.js`](https://facilmap.org/app.js) and [`app.css`](https://facilmap.org/app.css) (if you want
to include the dependencies yourself, see [`bower.json`](bower.json)) into you page. If you want to build those files
yourself, check out this repository, run `npm run build` and find them in `frontend/build/`.

Now include `socket.io`, and, if you want to use a different server than `https://facilmap.org/`, set the server URL:

```html
<script src="https://facilmap.org/socket.io/socket.io.js"></script>
<script>
    FacilPad.SERVER = "https://facilmap.org/";
</script>
```

Now, if your page uses angular, simply add the `facilmap` module as a dependency to your application:
 
```js
angular.module("myapp", [ "facilmap" ]);
```

Otherwise, add the `ng-app` attribute to your `html` element:

```html
<!DOCTYPE html>
<html ng-app="facilmap">
```

Now, anywhere on your page, you can add a `facilmap` element:

```html
<facilmap id="map" fm-map-id="mymap"></facilmap>
```

`fm-map-id` is the map ID as it would appear on `https://facilmap.org/`**`mymap`**. It can be a read-only or read-write ID.


Running the server
==================

Using docker
------------

FacilMap is available as [`facilmap/facilmap2`](https://hub.docker.com/r/facilmap/facilmap2/) on Docker Hub. Here is
an example `docker-compose.yml`:

```yml
facilmap:
    image: facilmap/facilmap2
    ports:
        - 8080
    external_links:
        - mysql_mysql_1
    environment:
        USER_AGENT: My FacilMap (https://facilmap.example.org/, facilmap@example.org)
        DB_TYPE: mysql
        DB_HOST: mysql_mysql_1
        DB_NAME: facilmap
        DB_USER: facilmap
        DB_PASSWORD: password
    restart: on-failure
```

Or the same using `docker create`:

```bash
docker create --link=mysql_mysql_1 -p 8080 --name=facilmap -e "USER_AGENT=My FacilMap (https://facilmap.example.org/, facilmap@example.org)" -e DB_TYPE=mysql -e DB_HOST=mysql_mysql_1 -e DB_NAME=facilmap -e DB_USER=facilmap -e DB_PASSWORD=facilmap --restart on-failure facilmap/facilmap2
```

See [below](#config) for the available config options.

Both the FacilMap server and the frontend will be available via HTTP on port `8080`. It is recommended to use a reverse
proxy, such as [`rankenstein/https-proxy-letsencrypt`](https://hub.docker.com/r/rankenstein/https-proxy-letsencrypt/),
to make it available over HTTPS.

Standalone
----------

To run the FacilMap server by hand, follow the following steps:

1. Make sure that you have a recent version of [Node.js](https://nodejs.org/) and a database (MariaDB, MySQL, PostgreSQL,
   SQLite, Microsoft SQL Server) set up. (Note that only MySQL has been tested so far.)
2. Check out this repository (`git clone https://github.com/FacilMap/facilmap2.git`)
3. Customise [`config.js`](config.js) (see options [below](#config))
4. Make sure you have yarn installed (`npm install -g yarn`)
5. If you want to use a database other than MySQL, you will have to install the driver using `yarn add pg` (for
   PostgreSQL), `yarn add sqlite3`, or `yarn add tedious` (for MSSQL).
6. Run `npm start`



Config
------

The config can be set either by using environment variables (useful for docker) or by editing [`config.js`](config.js).

| `config.js` value | Environment variable | Meaning                                                                                                                          |
|-------------------|----------------------|----------------------------------------------------------------------------------------------------------------------------------|
| `userAgent`       | `USER_AGENT`         | Will be used for all HTTP requests (search, routing, GPX/KML/OSM/GeoJSON files). You better provide your e-mail address in here. |
| `host`            |                      | The ip address to listen on.                                                                                                     |
| `port`            |                      | The port to listen on.                                                                                                           |
| `db.type`         | `DB_TYPE`            | The type of database. Either `mysql`, `postgres`, `mariadb`, `sqlite`, or `mssql`.                                               |
| `db.host`         | `DB_HOST`            | The host name of the database server (default: `localhost`).                                                                     |
| `db.port`         | `DB_PORT`            | The port of the database server (optional).                                                                                      |
| `db.database`     | `DB_NAME`            | The name of the database (default: `facilmap`).                                                                                  |
| `db.user`         | `DB_USER`            | The username to connect to the database with (default: `facilmap`).                                                              |
| `db.password`     | `DB_PASSWORD`        | The password to connect to the database with.                                                                                    |