#!/usr/bin/env node

import Database from "./database/database.js";
import Socket from "./socket.js";
import config from "./config.js";
import { initWebserver } from "./webserver.js";

Object.defineProperty(Error.prototype, "toJSON", {
	value: function() {
		let str = this.message;
		if(this.errors) {
			for(const error of this.errors)
				str += "\n"+error.message;
		}

		return str;
	},
	configurable: true
});

process.on('unhandledRejection', (reason) => {
	console.trace("Unhandled rejection", reason);
});

async function start() {
	const database = new Database(config.db);

	await database.connect();

	const server = await initWebserver(database, config.port, config.host);

	new Socket(server, database);

	console.log("Server started on " + (config.host || "*" ) + ":" + config.port);
}

start().catch(err => {
	console.error(err);
	process.exit(1);
});
