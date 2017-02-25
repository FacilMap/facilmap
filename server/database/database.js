var util = require("util");
var events = require("events");
var Sequelize = require("sequelize");
var debug = require("debug");

var utils = require("../utils");

class Database extends events.EventEmitter {

	constructor(dbConfig) {
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

		for(let func of this._init)
			func.call(this);

		for(let func of this._afterInit)
			func.call(this);
	}

	connect(force) {
		return this._conn.authenticate().then(() => {
			return this._conn.sync({ force: !!force });
		}).then(() => {
			this._runMigrations()
		});
	}
}

Database.prototype._init = [ ];
Database.prototype._afterInit = [ ];

require("./migrations")(Database);
require("./helpers")(Database);

require("./pad")(Database);
require("./marker")(Database);
require("./line")(Database);
require("./view")(Database);
require("./type")(Database);
require("./history")(Database);
require("./meta")(Database);

module.exports = Database;