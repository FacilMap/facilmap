#!/usr/bin/env node

import fs from "fs";
import path from "path";


const configPath = path.resolve(process.argv[2] || `${__dirname}/../config.js`);

if(!fs.existsSync(configPath)) {
	console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <config.js>`);
	process.exit(1);
}

const config = require(configPath);

process.env.fmUserAgent = config.userAgent;


var Database = require("./database/database");
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

async function start() {
	const database = new Database(config.db);

	await database.connect();

	const server = await webserver.init(database, config.port, config.host);

	new Socket(server, database);

	console.log("Server started on " + (config.host || "*" ) + ":" + config.port);
}

start().catch(err => {
	console.error(err);
	process.exit(1);
});
