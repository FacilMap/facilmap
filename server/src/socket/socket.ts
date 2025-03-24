import { Server, type Socket as SocketIO } from "socket.io";
import domain from "domain";
import Database from "../database/database.js";
import type { Server as HttpServer } from "http";
import { SocketVersion, socketRequestValidators, type SocketServerToClientEmitArgs } from "facilmap-types";
import type { SocketConnection, SocketHandlers } from "./socket-common";
import { SocketConnectionV1 } from "./socket-v1";
import { SocketConnectionV2 } from "./socket-v2.js";
import { handleSocketConnection } from "../i18n.js";
import { serializeError } from "serialize-error";
import { SocketConnectionV3 } from "./socket-v3.js";
import proxyAddr from "proxy-addr";
import config from "../config.js";

const constructors: {
	[V in SocketVersion]: new (emit: (...args: SocketServerToClientEmitArgs<V>) => void, database: Database, remoteAttr: string) => SocketConnection<V>;
} = {
	[SocketVersion.V1]: SocketConnectionV1,
	[SocketVersion.V2]: SocketConnectionV2,
	[SocketVersion.V3]: SocketConnectionV3
};

const trustProxy = config.trustProxy;
const compiledTrust: (addr: string, i: number) => boolean = (
	// Imitate compileTrust from express (https://github.com/expressjs/express/blob/815f799310a5627c000d4a5156c1c958e4947b4c/lib/utils.js#L215)
	trustProxy == null ? () => false :
	typeof trustProxy === "function" ? trustProxy :
	typeof trustProxy === "boolean" ? () => trustProxy :
	typeof trustProxy === "number" ? (a, i) => i < trustProxy :
	proxyAddr.compile(trustProxy)
);

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
			const remoteAttr = proxyAddr(socket.request, compiledTrust);

			const handler = new constructors[version]((...args: any) => {
				socket.emit(args[0], ...args.slice(1));
			}, this.database, remoteAttr);

			socket.on("error", (err) => {
				console.error("Error! Disconnecting client.");
				console.error(err);
				socket.disconnect();
			});
			socket.on("disconnect", () => {
				handler.handleDisconnect();
			});

			const socketHandlers = handler.getSocketHandlers();
			for (const i of Object.keys(socketHandlers) as Array<keyof SocketHandlers<SocketVersion>>) {
				socket.on(i, async (...args: unknown[]): Promise<void> => {
					const validatedCallback = (typeof args[args.length - 1] === "function" ? args.pop() as (...args: any) => any : undefined);

					try {
						console.log(i, args);
						const validatedArgs = socketRequestValidators[version][i].parse(args);
						const res = await (socketHandlers[i] as any)(...validatedArgs);

						if(!validatedCallback && res)
							console.trace("No callback available to send result of socket handler " + i);

						validatedCallback?.(null, res);
					} catch (err: any) {
						const outerErr = new Error(`Invalid arguments for socket method ${i}`, { cause: err });
						console.log(outerErr);

						validatedCallback?.(serializeError(outerErr));
					}
				});
			}
		}).catch((err) => {
			d.emit("error", err);
		});
	}
}
