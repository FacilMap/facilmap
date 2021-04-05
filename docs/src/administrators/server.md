# Run your own server

## Using docker

FacilMap is available as [`facilmap/facilmap`](https://hub.docker.com/r/facilmap/facilmap/) on Docker Hub. Here is
an example `docker-compose.yml`:

```yaml
version: "2"
services:
    facilmap:
        image: facilmap/facilmap
        ports:
            - 8080
        links:
            - db
        environment:
            USER_AGENT: My FacilMap (https://facilmap.example.org/, facilmap@example.org)
            DB_TYPE: mysql
            DB_HOST: db
            DB_NAME: facilmap
            DB_USER: facilmap
            DB_PASSWORD: password
            ORS_TOKEN: # Get an API key on https://go.openrouteservice.org/ (needed for routing)
            MAPBOX_TOKEN: # Get an API key on https://www.mapbox.com/signup/ (needed for routing)
            MAPZEN_TOKEN: # Get an API key on https://mapzen.com/developers/sign_up (needed for elevation info)
            MAXMIND_USER_ID: # Sign up here https://www.maxmind.com/en/geolite2/signup (needed for geoip lookup to show initial map state)
            MAXMIND_LICENSE_KEY: 
        restart: on-failure
    db:
        image: mariadb
        environment:
            MYSQL_DATABASE: facilmap
            MYSQL_USER: facilmap
            MYSQL_PASSWORD: password
            MYSQL_RANDOM_ROOT_PASSWORD: "true"
```

Or the same using `docker create`:

```bash
docker create --link=mysql_mysql_1 -p 8080 --name=facilmap -e "USER_AGENT=My FacilMap (https://facilmap.example.org/, facilmap@example.org)" -e DB_TYPE=mysql -e DB_HOST=mysql_mysql_1 -e DB_NAME=facilmap -e DB_USER=facilmap -e DB_PASSWORD=facilmap -e ORS_TOKEN= -e MAPBOX_TOKEN= -e MAPZEN_TOKEN= --restart on-failure facilmap/facilmap
```

See [below](#config) for the available config options.

Both the FacilMap server and the frontend will be available via HTTP on port `8080`. It is recommended to use a reverse
proxy, such as [`jwilder/nginx-proxy`](https://hub.docker.com/r/jwilder/nginx-proxy), to make it available over HTTPS.


## Standalone

To run the FacilMap server by hand, follow the following steps:

1. Make sure that you have a recent version of [Node.js](https://nodejs.org/), [yarn](https://yarnpkg.com/)
   and a database (MariaDB, MySQL, PostgreSQL, SQLite, Microsoft SQL Server) set up. (Note that only MySQL/MariaDB has been tested so far.)
2. Clone the [FacilMap repository](https://github.com/FacilMap/facilmap).
3. Run `yarn install` in the root folder of this repository to install the dependencies.
4. Run `yarn build` to create the JS bundles.
5. Copy `config.env.example` to `config.env` and adjust the configuration (see [below](#config) for the available options).
6. Inside the `server` directory, run `yarn server`. This will automatically set up the database structure and start the server.


## Config

The config can be set either by using environment variables (useful for docker) or by editing `config.env`.

| Variable              | Required | Default     | Meaning                                                                                                                          |
|-----------------------|----------|-------------|----------------------------------------------------------------------------------------------------------------------------------|
| `USER_AGENT`          | *        |             | Will be used for all HTTP requests (search, routing, GPX/KML/OSM/GeoJSON files). You better provide your e-mail address in here. |
| `HOST`                |          |             | The ip address to listen on (leave empty to listen on all addresses)                                                             |
| `PORT`                |          | `8080`      | The port to listen on.                                                                                                           |
| `DB_TYPE`             |          | `mysql`     | The type of database. Either `mysql`, `postgres`, `mariadb`, `sqlite`, or `mssql`.                                               |
| `DB_HOST`             |          | `localhost` | The host name of the database server.                                                                                            |
| `DB_PORT`             |          |             | The port of the database server (optional).                                                                                      |
| `DB_NAME`             |          | `facilmap`  | The name of the database.                                                                                                        |
| `DB_USER`             |          | `facilmap`  | The username to connect to the database with.                                                                                    |
| `DB_PASSWORD`         |          | `facilmap`  | The password to connect to the database with.                                                                                    |
| `ORS_TOKEN`           | *        |             | [OpenRouteService API key](https://go.openrouteservice.org).                                                                     |
| `MAPBOX_TOKEN`        | *        |             | [Mapbox API key](https://www.mapbox.com/signup/).                                                                                |
| `MAPZEN_TOKEN`        |          |             | [Mapzen API key](https://mapzen.com/developers/sign_up).                                                                         |
| `MAXMIND_USER_ID`     |          |             | [MaxMind user ID](https://www.maxmind.com/en/geolite2/signup).                                                                   |
| `MAXMIND_LICENSE_KEY` |          |             | MaxMind license key.                                                                                                             |

FacilMap makes use of several third-party services that require you to register (for free) and generate an API key:
* Mapbox and OpenRouteService are used for calculating routes. Mapbox is used for basic routes, OpenRouteService is used when custom route mode settings are made. If these API keys are not defined, calculating routes will fail.
* Maxmind provides a free database that maps IP addresses to approximate locations. FacilMap downloads this database to decide the initial map view for users (IP addresses are looked up in FacilMap’s copy of the database, on IP addresses are sent to Maxmind). This API key is optional, if it is not set, the default view will be the whole world.
* Mapzen is used to look up the elevation info for search results. The API key is optional, if it is not set, no elevation info will be available for search results.