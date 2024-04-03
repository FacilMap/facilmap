import Database from "./database/database.js";
import Socket from "./socket/socket.js";
import config from "./config.js";
import { initWebserver } from "./webserver.js";

export async function startServer(conf = config): Promise<void> {
	const database = new Database(conf.db);

	await database.connect();

	const server = await initWebserver(database, conf.port, conf.host);

	new Socket(server, database);

	console.log("Server started on " + (conf.host || "*" ) + ":" + conf.port);
}