var util = require("util");
var events = require("events");
var Sequelize = require("sequelize");

var utils = require("../utils");
var config = require("../../config");

class Database extends events.EventEmitter {

	constructor() {
		super();

		this._conn = new Sequelize(config.db.database, config.db.user, config.db.password, {
			dialect: config.db.type,
			host: config.db.host,
			port: config.db.port,
			define: {
				timestamps: false
			}
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

module.exports = Database;