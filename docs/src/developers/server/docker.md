# Docker

[Docker](https://www.docker.com/) is a container management system that is commonly used to run applications on servers. A docker image contains a full Linux system with one particular application installed, and docker runs this in a simulated virtual environment that is isolated from the rest of the server. The main advantages are security (if a hacker gains access to an application that is running inside a docker container is hacked, it is hard to impossible to gain access to the rest of the system from there) and simplicity (applications can be installed, updated and removed without leaving any traces behind using a single command).

This manual assumes that you have docker set up on your system.

The FacilMap server is available as [`facilmap/facilmap`](https://hub.docker.com/r/facilmap/facilmap/) on Docker Hub. The [configuration](./config.md) can be defined using environment variables. The container will expose a HTTP server on port 8080, which you should put behind a reverse proxy such as [nginx-proxy](https://hub.docker.com/r/jwilder/nginx-proxy) or [traefik](https://traefik.io/traefik/) for HTTPS support.

FacilMap needs a database supported by [Sequelize](https://sequelize.org/master/) to run, it is recommended to use MySQL/MariaDB. When creating a MySQL/MariaDB database for FacilMap, make sure to use the `utf8mb4` charset/collation to make sure that characters from all languages can be used on a map. By default, MySQL/MariaDB uses the `latin1` charset, which mostly supports only basic latin characters. When you start the FacilMap server for the first time, the necessary tables are created using the charset of the database. When using PostgreSQL, the PostGIS extensions must be enabled.

## docker-compose

To run FacilMap with MySQL using [docker-compose](https://docs.docker.com/compose/), here is an example `docker-compose.yml`:

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
			TRUST_PROXY: "true"
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
			LIMA_LABS_TOKEN: # Get an API key on https://maps.lima-labs.com/ (optional, needed for double-resolution tiles)
		restart: unless-stopped
	db:
		image: mariadb
		environment:
			MYSQL_DATABASE: facilmap
			MYSQL_USER: facilmap
			MYSQL_PASSWORD: password
			MYSQL_RANDOM_ROOT_PASSWORD: "true"
		cmd: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
		restart: unless-stopped
```

Here is an example with Postgres:

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
			TRUST_PROXY: "true"
			DB_TYPE: postgres
			DB_HOST: db
			DB_NAME: facilmap
			DB_USER: facilmap
			DB_PASSWORD: password
			ORS_TOKEN: # Get an API key on https://go.openrouteservice.org/ (needed for routing)
			MAPBOX_TOKEN: # Get an API key on https://www.mapbox.com/signup/ (needed for routing)
			MAPZEN_TOKEN: # Get an API key on https://mapzen.com/developers/sign_up (needed for elevation info)
			MAXMIND_USER_ID: # Sign up here https://www.maxmind.com/en/geolite2/signup (needed for geoip lookup to show initial map state)
			MAXMIND_LICENSE_KEY:
			LIMA_LABS_TOKEN: # Get an API key on https://maps.lima-labs.com/ (optional, needed for double-resolution tiles)
		restart: unless-stopped
	db:
		image: postgis/postgis
		environment:
			POSTGRES_USER: facilmap
			POSTGRES_PASSWORD: password
			POSTGRES_DB: facilmap
		restart: unless-stopped
```

To start FacilMap, run `docker-compose up -d` in the directory of the `docker-compose.yml` file. To upgrade FacilMap, run `docker-compose pull` and then restart it by running `docker-compose up -d`.

## docker create

To manually create the necessary docker containers, use these commands:

```bash
docker create --name=facilmap_db -e MYSQL_DATABASE=facilmap -e MYSQL_USER=facilmap -e MYSQL_PASSWORD=password -e MYSQL_RANDOM_ROOT_PASSWORD=true --restart=unless-stopped mariadb --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
docker create --link=facilmap_db -p 8080 --name=facilmap -e "USER_AGENT=My FacilMap (https://facilmap.example.org/, facilmap@example.org)" -e TRUST_PROXY=true -e DB_TYPE=mysql -e DB_HOST=facilmap_db -e DB_NAME=facilmap -e DB_USER=facilmap -e DB_PASSWORD=facilmap -e ORS_TOKEN= -e MAPBOX_TOKEN= -e MAPZEN_TOKEN= -e MAXMIND_USER_ID= -e MAXMIND_LICENSE_KEY= -e LIMA_LABS_TOKEN= --restart=unless-stopped facilmap/facilmap
```