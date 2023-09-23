# Configuration

The config of the FacilMap server can be set either by using environment variables (useful for docker) or by editing `config.env`.

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
| `ORS_TOKEN`           | *        |             | [OpenRouteService API key](https://openrouteservice.org/).                                                                     |
| `MAPBOX_TOKEN`        | *        |             | [Mapbox API key](https://www.mapbox.com/signup/).                                                                                |
| `MAPZEN_TOKEN`        |          |             | [Mapzen API key](https://mapzen.com/developers/sign_up).                                                                         |
| `MAXMIND_USER_ID`     |          |             | [MaxMind user ID](https://www.maxmind.com/en/geolite2/signup).                                                                   |
| `MAXMIND_LICENSE_KEY` |          |             | MaxMind license key.                                                                                                             |

FacilMap makes use of several third-party services that require you to register (for free) and generate an API key:
* Mapbox and OpenRouteService are used for calculating routes. Mapbox is used for basic routes, OpenRouteService is used when custom route mode settings are made. If these API keys are not defined, calculating routes will fail.
* Maxmind provides a free database that maps IP addresses to approximate locations. FacilMap downloads this database to decide the initial map view for users (IP addresses are looked up in FacilMap’s copy of the database, on IP addresses are sent to Maxmind). This API key is optional, if it is not set, the default view will be the whole world.
* Mapzen is used to look up the elevation info for search results. The API key is optional, if it is not set, no elevation info will be available for search results.