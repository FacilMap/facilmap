import Database from "./database/database.js";
import Socket from "./socket/socket.js";
import config from "./config.js";
import { initWebserver } from "./webserver.js";
import DatabaseBackend from "./database-backend/database-backend.js";

export async function startServer(conf = config): Promise<void> {
	const backend = new DatabaseBackend(conf.db);
	await backend.connect();

	const database = new Database(backend);

	const server = await initWebserver(database, conf.port, conf.host);

	new Socket(server, database);

	console.log("Server started on " + (conf.host || "*" ) + ":" + conf.port);
}