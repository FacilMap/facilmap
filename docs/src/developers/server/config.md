# Configuration

The config of the FacilMap server can be set either by using environment variables (useful for docker) or by editing `config.env`.

| Variable              | Required | Default     | Meaning                                                                                                                          |
|-----------------------|----------|-------------|----------------------------------------------------------------------------------------------------------------------------------|
| `USER_AGENT`          | *        |             | Will be used for all HTTP requests (search, routing, GPX/KML/OSM/GeoJSON files). You better provide your e-mail address in here. |
| `APP_NAME`            |          |             | If specified, will replace “FacilMap” as the name of the app throughout the UI. |
| `TRUST_PROXY`         |          |             | Whether to trust the X-Forwarded-* headers. Can be `true` or a comma-separated list of IP subnets (see the [express documentation](https://expressjs.com/en/guide/behind-proxies.html)). Currently only used to calculate the base URL for the `opensearch.xml` file. |
| `BASE_URL`            |          |             | If `TRUST_PROXY` does not work for your particular setup, you can manually specify the base URL where FacilMap can be publicly reached here. |
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
| `MAXMIND_USER_ID`     |          |             | [MaxMind user ID](https://www.maxmind.com/en/geolite2/signup).                                                                   |
| `MAXMIND_LICENSE_KEY` |          |             | MaxMind license key.                                                                                                             |
| `LIMA_LABS_TOKEN`     |          |             | [Lima Labs](https://maps.lima-labs.com/) API key |
| `HIDE_COMMERCIAL_MAP_LINKS` |    |             | Set to `1` to hide the links to Google/Bing Maps in the “Map style” menu. |
| `CUSTOM_CSS_FILE`     |          |             | The path of a CSS file that should be included ([see more details below](#custom-css-file)). |
| `NOMINATIM_URL`       |          | `https://nominatim.openstreetmap.org` | The URL to the Nominatim server (used to search for places). |
| `OPEN_ELEVATION_URL`  |          | `https://api.open-elevation.com` | The URL to the Open Elevation server (used to look up the elevation for markers). |
| `OPEN_ELEVATION_THROTTLE_MS` |   | `1000` | The minimum time between two requests to the Open Elevation API. Set to `0` if you are using your own self-hosted instance of Open Elevation. |
| `OPEN_ELEVATION_MAX_BATCH_SIZE` | | `200` | The maximum number of points to resolve in one request through the Open Elevation API. Set this to `1000` if you are using your own self-hosted Open Elevation instance. |

FacilMap makes use of several third-party services that require you to register (for free) and generate an API key:
* Mapbox and OpenRouteService are used for calculating routes. Mapbox is used for basic routes, OpenRouteService is used when custom route mode settings are made. If these API keys are not defined, calculating routes will fail.
* Maxmind provides a free database that maps IP addresses to approximate locations. FacilMap downloads this database to decide the initial map view for users (IP addresses are looked up in FacilMap’s copy of the database, on IP addresses are sent to Maxmind). This API key is optional, if it is not set, the default view will be the whole world.
* Lima Labs is used for nicer and higher resolution map tiles than Mapnik. The API key is optional, if it is not set, Mapnik will be the default map style instead.

## Custom CSS file

To include a custom CSS file in the UI, set the `CUSTOM_CSS_FILE` environment variable to the file path.

When running FacilMap with docker, you can mount your CSS file as a volume into the container, for example with the following docker-compose configuration:
```yaml
		environment:
			CUSTOM_CSS_FILE: /opt/facilmap/custom.css
		volumes:
			- ./custom.css:/opt/facilmap/custom.css
```

Your custom CSS file will be included in the map UI and in the table export. You can distinguish between the two by using the `html.fm-facilmap-map` and `html.fm-facilmap-table` selectors.