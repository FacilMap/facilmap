# Standalone

The FacilMap server is written in [node.js](https://nodejs.org/en/). To run the FacilMap server, the following dependencies are needed:
* You need to have a recent version of node.js and npm installed.
* You need to create a database on one of the systems supported by [Sequelize](https://sequelize.org/master/), it is recommended to use MySQL/MariaDB. When creating a database for FacilMap, make sure to use the `utf8mb4` charset/collation to make sure that characters from all languages can be used on a map. By default, MySQL/MariaDB uses the `latin1` charset, which mostly supports only basic latin characters. When you start the FacilMap server for the first time, the necessary tables are created using the charset of the database.
* It is recommended to run FacilMap as an unprivileged user.

## Run the latest release

A bundled version of the FacilMap server is published on NPM as [facilmap-server](https://www.npmjs.com/package/facilmap-server). To run it, run the following steps:

1. If you don’t have a global NPM prefix set up yet, run `npm config set prefix ~/.local`. This will install npm packages into `~/.local/bin`, rather than trying to install them into `/usr/local/bin`.
2. Install facilmap-server by running `npm install -g facilmap-server`
3. Create a `config.env` file based on [`config.env.example`](https://github.com/FacilMap/facilmap/blob/master/config.env.example) and to adjust the [configuration](./config.md).
4. Start the FacilMap server by running `~/.local/bin/facilmap-server dotenv_config_path=config.env`.

FacilMap will need write access to the directory `~/.local/lib/node_modules/facilmap-server/cache`. All other files and directories can be read-only. To harden the FacilMap installation, make the whole installation folder owned by root, but create the cache directory and make it owned by the facilmap user.


## Run the development version

To run the latest state from the [FacilMap repository](https://github.com/FacilMap/facilmap), run the following steps:

1. Make sure that you have a recent version of [Node.js](https://nodejs.org/), [yarn](https://yarnpkg.com/)
   and a database (MariaDB, MySQL, PostgreSQL, SQLite, Microsoft SQL Server) set up. (Note that only MySQL/MariaDB has been tested so far.)
2. Clone the [FacilMap repository](https://github.com/FacilMap/facilmap).
3. Run `yarn install` in the root folder of this repository to install the dependencies.
4. Run `yarn build` to create the JS bundles.
5. Copy `config.env.example` to `config.env` and adjust the [configuration](./config.md).
6. Inside the `server` directory, run `yarn server`. This will automatically set up the database structure and start the server.

You can also run `yarn dev-server`, which will automatically rebuild the frontend bundle when the code is changed. See [dev setup](../development/dev-setup.md) for more information.