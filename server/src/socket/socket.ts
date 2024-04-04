import { Server, type Socket as SocketIO } from "socket.io";
import domain from "domain";
import Database from "../database/database.js";
import type { Server as HttpServer } from "http";
import { SocketVersion } from "facilmap-types";
import type { SocketConnection } from "./socket-common";
import { SocketConnectionV1 } from "./socket-v1";
import { SocketConnectionV2 } from "./socket-v2";
import { handleSocketConnection } from "../i18n.js";

const constructors: Record<SocketVersion, new (socket: SocketIO, database: Database) => SocketConnection> = {
	[SocketVersion.V1]: SocketConnectionV1,
	[SocketVersion.V2]: SocketConnectionV2
};

export default class Socket {
	database: Database;

	constructor(server: HttpServer, database: Database) {
		this.database = database;

		const io = new Server(server, {
			cors: { origin: true },
			allowEIO3: true,
			maxHttpBufferSize: 100e6
		});

		io.of("/").on("connection", (socket) => {
			this.handleConnection(SocketVersion.V1, socket);
		});

		for (const version of Object.values(SocketVersion)) {
			io.of(`/${version}`).on("connection", (socket) => {
				this.handleConnection(version, socket);
			});
		}
	}

	handleConnection(version: SocketVersion, socket: SocketIO): void {
		const d = domain.create();
		d.add(socket);

		d.on("error", function(err) {
			console.error("Uncaught error in socket:", err);
			socket.disconnect();
		});

		d.run(async () => {
			await handleSocketConnection(socket);
		}).then(() => {
			new constructors[version](socket, this.database);
		}).catch((err) => {
			d.emit("error", err);
		});
	}
}
