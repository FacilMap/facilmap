var http = require("http");
var compression = require("compression");
var domain = require("domain");
var Promise = require("promise");
var express = require("express");
var path = require("path");

var config = require("../config");
var Database = require("./database/database");
var utils = require("./utils");
var Socket = require("./socket");

var frontendPath = path.resolve(__dirname + "/../frontend");

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

utils.promiseAuto({
	database: () => new Database(),

	databaseConnect: database => database.connect(),

	server: () => {
		var app = express();
		app.use(compression());

		app.get("/bundle-:hash.js", function(req, res, next) {
			res.setHeader('Cache-Control', 'public, max-age=31557600'); // one year

			next();
		});

		app.use(express.static(frontendPath + "/build/"));
		app.get("/:padId", function(req, res) {
			res.sendFile(frontendPath + "/build/index.html");
		});

		var server = http.createServer(app);
		return Promise.denodeify(server.listen.bind(server))(config.port, config.host).then(() => server);
	},

	socket: (server, database) => {
		return new Socket(server, database);
	}
}).then(res => {
	console.log("Server started on " + (config.host || "*" ) + ":" + config.port);
}).catch(err => {
	console.error(err);
	process.exit(1);
});