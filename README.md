[FacilMap](https://facilmap.org/) is a privacy-friendly, open-source versatile online map that combines different services based on OpenStreetMap and makes it easy to find places, plan trips and add markers, lines and routes to custom maps with live collaboration. Features include:

* Choose between different map styles for roads, topography, cycling, hiking, public transportation, water navigation, …
* Search for places and show their information (website, opening hours, …)
* Calculate routes and adjust them by dragging, optionally with an elevation profile and details about road quality
* Show POIs on the map (amenities, attractions, businesses, …)
* Smartphone-friendly interface and Progressive Web App
* Create collaborative maps, add markers, lines and routes and collaborate live through a share link
* View GPX/KML/OSM/GeoJSON files or import them to a collaborative map
* Export collaborative maps to GPX or GeoJSON to import them into Osmand or other apps
* Link or embed a read-only or editable version of a collaborative map on your website
* Define different types of markers/lines with custom form fields to be filled out
* Create custom views where markers/lines are shown/hidden based on their form field values
* Define custom styles of markers/lines and routes and generate a legend automatically
* Export the field values of markers/lines as HTML or CSV to import them into a spreadsheet
* Programmatically read and modify collaborative maps through a Socket.io API
* Extensive [user and developer documentation](https://docs.facilmap.org/).

Documentation
=============

For more information, have a look at the [documentation](https://docs.facilmap.org/).

Quick links:
* [User guide](https://docs.facilmap.org/users/)
* [Embed FacilMap into a website](https://docs.facilmap.org/developers/embed.html)
* [Run the FacilMap server](https://docs.facilmap.org/developers/server/)
* [Use the FacilMap client](https://docs.facilmap.org/developers/client/) to programmatically modify objects on a collaborative map.
* [Dev setup](https://docs.facilmap.org/developers/development/dev-setup.html)


Get help
========

* Have a look at the [documentation](https://docs.facilmap.org/)
* Ask questions [on GitHub](https://github.com/FacilMap/facilmap/discussions)
* Raise bugs and feature requests [on GitHub](https://github.com/FacilMap/facilmap/issues)
* Join the [Matrix chat room](https://matrix.to/#/#facilmap:rankenste.in)


Quick start
===========

1. Run `yarn install` to install the dependencies
2. Run `yarn build` to build the JS bundles
3. Copy `config.env.example` to `config.env` and adjust the settings
4. Run `yarn server` inside the `server` directory

More details can be found in the [Administrator guide](https://docs.facilmap.org/administrators/server.html#standalone) and the [Developer guide](https://docs.facilmap.org/developers/development/dev-setup.html).


Support FacilMap
================

I have been working on FacilMap as a hobby since 2009. While I have plenty of ideas and motivation to develop the app further, I have only limited time and resources to do so. By [financially supporting](https://docs.facilmap.org/users/contribute/) FacilMap, you allow me to spend more time implementing new features and to afford the infrastructure that is necessary to keep the app running for a growing number of users. Also, feel free to request the features that you would like to see!