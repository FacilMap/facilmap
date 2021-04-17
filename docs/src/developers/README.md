# Overview

## Quick links

* [Embed FacilMap](./embed) into any website using an iframe.
* Run your own [FacilMap server](./server/).
* Use the [FacilMap client](./client/) to programmatically access and modify data on a collaborative map.
* Read about the [dev setup](./development/dev-setup) to start contributing to the FacilMap code.

## Structural overview

FacilMap consists of several layers:
* The **Server** is a Node.js app that stores the data of collaborative maps in a database and runs a [socket.io](https://socket.io/) server to access and modify those maps. It also includes a HTTP server that serves the frontend and the map exports.
* The **Client** is a JavaScript library that provides methods to access the data on collaborative maps by sending requests to the socket.io server.
* The **Leaflet components** is a JavaScript library that provides classes to dynamically show the data received by the Client on a [Leaflet](https://leafletjs.com/) map.
* The **Frontend** is a JavaScript app that provides a complete UI written in [Vue.js](https://vuejs.org/) to create, access and modify collaborative maps. It uses the Client to access those maps and the Leaflet components to render them on a map.

FacilMap is completely written in [TypeScript](https://www.typescriptlang.org/). The code base is split into several NPM modules, each of which can be used independently (although some depend on some others):

* [facilmap-types](https://www.npmjs.com/package/facilmap-types) provides common TypeScript types for map objects and the socket communication and is used by all other modules.
* [facilmap-client](https://www.npmjs.com/package/facilmap-client) contains the [FacilMap client](./client/).
* [facilmap-utils](https://www.npmjs.com/package/facilmap-utils) contains helper methods that are used by facilmap-leaflet, facilmap-frontend and facilmap-server, so they can run both in the browser and in Node.js.
* [facilmap-leaflet](https://www.npmjs.com/package/facilmap-leaflet) contains the Leaflet components.
* [facilmap-frontend](https://www.npmjs.com/package/facilmap-frontend) contains the Frontend.
* [facilmap-server](https://www.npmjs.com/package/facilmap-server) contains the [Server](./server/).