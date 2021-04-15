# Standalone

The FacilMap server is written in [node.js](https://nodejs.org/en/). To run the FacilMap server, the following dependencies are needed:
* You need to have a recent version of node.js and npm installed.
* You need to create a database on one of the systems supported by [Sequelize](https://sequelize.org/master/), it is recommended to use MySQL/MariaDB. When creating a database for FacilMap, make sure to use the `utf8mb4` charset/collation to make sure that characters from all languages can be used on a map. By default, MySQL/MariaDB uses the `latin1` charset, which mostly supports only basic latin characters. When you start the FacilMap server for the first time, the necessary tables are created using the charset of the database.
* It is recommended to run FacilMap as an unprivileged user.


## Run the development version

To run the latest state from the [FacilMap repository](https://github.com/FacilMap/facilmap), run the following steps:

1. Make sure that you have a recent version of [Node.js](https://nodejs.org/), [yarn](https://yarnpkg.com/)
   and a database (MariaDB, MySQL, PostgreSQL, SQLite, Microsoft SQL Server) set up. (Note that only MySQL/MariaDB has been tested so far.)
2. Clone the [FacilMap repository](https://github.com/FacilMap/facilmap).
3. Run `yarn install` in the root folder of this repository to install the dependencies.
4. Run `yarn build` to create the JS bundles.
5. Copy `config.env.example` to `config.env` and adjust the [configuration](./config).
6. Inside the `server` directory, run `yarn server`. This will automatically set up the database structure and start the server.

You can also run `yarn dev-server`, which will automatically rebuild the frontend bundle when the code is changed. See [dev setup](../development/dev-setup) for more information.