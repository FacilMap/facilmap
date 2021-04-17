# Overview

The FacilMap server is a HTTP server that fulfills the following tasks:
* Serve the frontend under `/` and `/<map ID>`.
* Serve exported collaborative maps under `/<map ID>/<type>`, where `<type>` can be `table`, `gpx` or `geojson`.
* Run a socket.io server under `/socket.io`. The frontend connects to this using the [FacilMap client](../client/) and uses it to get calculated routes, get and update the data on a collaborative map, and receive live updates to a collaborative map, and as a proxy to perform searches.
* Maintain a connection to a database where collaborative map data and calculated routes are stored.

The official FacilMap server is running on [https://facilmap.org/](https://facilmap.org/). If you want, you can run your own FacilMap server using one of these options:
* [Docker](./docker) will run the server in an isolated container. It is easer to set up and more secure, but takes more resources.
* Running the server [standalone](./standalone) takes less resources, but is less secure and takes more steps to set up.