import { EventEmitter } from "events";
import { Sequelize } from "sequelize";
import debug from "debug";
import DatabaseHelpers from "./helpers";
import DatabaseHistory from "./history";
import { DbConfig } from "../config";

export default class Database extends EventEmitter {

	_conn: Sequelize;
	helpers: DatabaseHelpers;
	history: DatabaseHistory;

	constructor(dbConfig: DbConfig) {
		super();

		this._conn = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
			dialect: dbConfig.type,
			host: dbConfig.host,
			port: dbConfig.port,
			define: {
				timestamps: false
			},
			logging: debug.enabled("sql") ? console.log : false
		});

		this.helpers = new DatabaseHelpers(this);
		this.history = new DatabaseHistory(this);

		this.history.afterInit();
	}

	connect(force: boolean) {
		return this._conn.authenticate().then(() => {
			return this._conn.sync({ force: !!force });
		}).then(() => {
			return this._runMigrations()
		});
	}
}

require("./migrations")(Database);
require("./helpers")(Database);

require("./pad")(Database);
require("./marker")(Database);
require("./line")(Database);
require("./view")(Database);
require("./type")(Database);
require("./history")(Database);
require("./meta")(Database);
require("./route")(Database);
require("./search")(Database);

module.exports = Database;