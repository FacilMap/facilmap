# Configuration

The config of the FacilMap server can be set either by using environment variables (useful for docker) or by editing `config.env`.

| Variable              | Required | Meaning                                                                                                                          |
|-----------------------|----------|----------------------------------------------------------------------------------------------------------------------------------|
| `USER_AGENT`          | *        | Will be used for all HTTP requests (search, routing, GPX/KML/OSM/GeoJSON files). You better provide your e-mail address in here. |
| `APP_NAME`            |          | If specified, will replace “FacilMap” as the name of the app throughout the UI. |
| `TRUST_PROXY`         |          | Whether to trust the X-Forwarded-* headers. Can be `true` or a comma-separated list of IP subnets (see the [express documentation](https://expressjs.com/en/guide/behind-proxies.html)). Currently only used to calculate the base URL for the `opensearch.xml` file. |
| `BASE_URL`            |          | If `TRUST_PROXY` does not work for your particular setup, you can manually specify the base URL where FacilMap can be publicly reached here. |
| `HOST`                |          | The ip address to listen on (leave empty to listen on all addresses) |
| `PORT`                |          | The port to listen on.<br><br>*Default:* `8080` |
| `DB_TYPE`             |          | The type of database. Either `mysql`, `postgres`, `mariadb`, `sqlite`, or `mssql`.<br><br>*Default:* `mysql` |
| `DB_HOST`             |          | The host name of the database server.<br><br>*Default:* `localhost` |
| `DB_PORT`             |          | The port of the database server (optional). |
| `DB_NAME`             |          | The name of the database.<br><br>*Default:* `facilmap` |
| `DB_USER`             |          | The username to connect to the database with.<br><br>*Default:* `facilmap` |
| `DB_PASSWORD`         |          | The password to connect to the database with.<br><br>*Default:* `facilmap` |
| `ORS_TOKEN`           |          | [OpenRouteService API key](https://openrouteservice.org/). If not specified, advanced routing settings will not be shown. |
| `MAPBOX_TOKEN`        |          | [Mapbox API key](https://www.mapbox.com/signup/). If neither this nor `ORS_TOKEN` are specified, the routing tab and any routing options will be hidden. |
| `MAXMIND_USER_ID`     |          | [MaxMind user ID](https://www.maxmind.com/en/geolite2/signup). |
| `MAXMIND_LICENSE_KEY` |          | MaxMind license key. |
| `LIMA_LABS_TOKEN`     |          | [Lima Labs](https://maps.lima-labs.com/) API key (for Lima Labs map style) |
| `THUNDERFOREST_TOKEN` |          | [Thunderforest](https://www.thunderforest.com/) API key (for OpenCycleMap map style) |
| `TRACESTRACK_TOKEN`   |          | [Tracestrack](https://tracestrack.com/) API key (for Tracestrack Topo map style) |
| `HIDE_COMMERCIAL_MAP_LINKS` |    | Set to `1` to hide the links to Google/Bing Maps in the “Map style” menu. |
| `CUSTOM_CSS_FILE`     |          | The path of a CSS file that should be included ([see more details below](#custom-css-file)). |
| `NOMINATIM_URL`       |          | The URL to the Nominatim server (used to search for places).<br><br>*Default:* `https://nominatim.openstreetmap.org` |
| `OPEN_ELEVATION_URL`  |          | The URL to the Open Elevation server (used to look up the elevation for markers).<br><br>*Default:* `https://api.open-elevation.com` |
| `OPEN_ELEVATION_THROTTLE_MS` |   | The minimum time between two requests to the Open Elevation API. Set to `0` if you are using your own self-hosted instance of Open Elevation.<br><br>*Default:* `1000` |
| `OPEN_ELEVATION_MAX_BATCH_SIZE` | | The maximum number of points to resolve in one request through the Open Elevation API. Set this to `1000` if you are using your own self-hosted Open Elevation instance.<br><br>*Default:* `200` |
| `DONATE_URL`          |          | Define a custom target for the “Donate” button. If you decide to link your own donation page to cover the costs of your hosting, consider mentioning FacilMap’s donation page there for the costs of the development of the software. You can also set this to an empty string to completely hide the donation button.<br><br>*Default:* `https://docs.facilmap.org/users/contribute/` |

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