var config = require("../config");
var Database = require("./database/database");
var utils = require("./utils");
var Socket = require("./socket");
var webserver = require("./webserver");

Object.defineProperty(Error.prototype, "toJSON", {
	value: function() {
		var str = this.message;
		if(this.errors) {
			for(var i=0; i<this.errors.length; i++)
				str += "\n"+this.errors[i].message;
		}

		return str;
	},
	configurable: true
});

process.on('unhandledRejection', (reason, promise) => {
	console.trace("Unhandled rejection", reason);
});

const database = new Database();

utils.promiseAuto({
	databaseConnect: database.connect(),

	server: (databaseConnect) => {
		return webserver.init();
	},

	socket: (server) => {
		return new Socket(server, database);
	}
}).then(res => {
	console.log("Server started on " + (config.host || "*" ) + ":" + config.port);
}).catch(err => {
	console.error(err);
	process.exit(1);
});