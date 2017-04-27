Running the FacilMap server
===========================

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
2. Install the facilmap server (`npm install -g facilmap-server`).
3. If you want to use a database other than MySQL, you will have to install the driver using `npm install -g pg` (for
   PostgreSQL), `npm install -g sqlite3`, or `npm install -g tedious` (for MSSQL).
4. Download [config.js](../config.js) and adjust the settings (see below for an explanation of the different parameters)
5. Run `facilmap-server config.js`

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

Development
-----------

To get the server running, run `yarn run deps` to install the dependencies, and then `yarn run server` to start the server.

For developing the frontend/client, FacilMap server can integrate a webpack-dev-server. This server will automatically
recompile the frontend files when a file changes, and even delay reloads until the compilation has finished. To run
the dev server, first link the dependencies by running `yarn link` in the `client/` and `frontend/` directories, and then
`yarn link facilmap-frontend facilmap-client` in the `server/` directory. Then start the server in development mode
using `FM_DEV=true npm run server`.

To enable debug output of various components, additionally prepend the command by `DEBUG=*`. See the documentation of
[debug](https://github.com/visionmedia/debug). To only enable the debug logging of SQL queries, use `DEBUG=sql`. To
enable the logging of outgoing HTTP requests, set `DEBUG=request`.
