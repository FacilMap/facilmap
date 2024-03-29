import { type Socket as SocketIO } from "socket.io";
import Database, { type DatabaseEvents } from "../database/database.js";
import { type EventHandler, type EventName, type SocketRequestName, type SocketResponse, SocketVersion, type ValidatedSocketRequest, socketRequestValidators } from "facilmap-types";

// Socket.io converts undefined to null. In socket handlers that allow a null response, let's also allow undefined.
type FixedNullResponse<T> = null extends T ? T | undefined | void : T;

export type SocketHandlers<V extends SocketVersion> = {
	[K in SocketRequestName<V>]: K extends SocketRequestName<V> ? ((data: ValidatedSocketRequest<V, K>) => FixedNullResponse<SocketResponse<V, K>> | PromiseLike<FixedNullResponse<SocketResponse<V, K>>>) : never;
};

export type DatabaseHandlers = {
	[eventName in EventName<DatabaseEvents>]?: EventHandler<DatabaseEvents, eventName>;
}

export abstract class SocketConnection {
	socket: SocketIO;
	database: Database;
	clearDatabaseHandlers: () => void = () => undefined;

	constructor(socket: SocketIO, database: Database) {
		this.socket = socket;
		this.database = database;

		this.socket.on("error", (err) => {
			this.handleError(err);
		});
		this.socket.on("disconnect", () => {
			this.handleDisconnect();
		});

		this.registerSocketHandlers();
		this.registerDatabaseHandlers();
	}

	abstract getSocketHandlers(): SocketHandlers<SocketVersion>;

	abstract getVersion(): SocketVersion;

	abstract getDatabaseHandlers(): DatabaseHandlers;

	getSocketRequestValidators(): typeof socketRequestValidators[SocketVersion] {
		return socketRequestValidators[this.getVersion()];
	}

	registerSocketHandlers(): void {
		const socketHandlers = this.getSocketHandlers();
		const validators = this.getSocketRequestValidators();
		for (const i of Object.keys(socketHandlers) as Array<keyof SocketHandlers<SocketVersion>>) {
			this.socket.on(i, async (data: unknown, callback: unknown): Promise<void> => {
				const validatedCallback = typeof callback === 'function' ? callback : undefined;

				try {
					const validatedData = validators[i].parse(data);
					const res = await (socketHandlers[i] as any)(validatedData);

					if(!validatedCallback && res)
						console.trace("No callback available to send result of socket handler " + i);

					validatedCallback?.(null, res);
				} catch (err: any) {
					console.log(err.stack);

					validatedCallback?.({ message: err.message, stack: err.stack });
				}
			});
		}
	}

	registerDatabaseHandlers(): void {
		this.clearDatabaseHandlers();

		const handlers = this.getDatabaseHandlers();

		for (const eventName of Object.keys(handlers) as Array<EventName<DatabaseEvents>>) {
			this.database.on(eventName as any, handlers[eventName] as any);
		}

		this.clearDatabaseHandlers = () => {
			for (const eventName of Object.keys(handlers) as Array<EventName<DatabaseEvents>>) {
				this.database.removeListener(eventName as any, handlers[eventName] as any);
			}
		};
	}

	handleError(err: Error): void {
		console.error("Error! Disconnecting client.");
		console.error(err);
		this.socket.disconnect();
	}

	handleDisconnect(): void {
		this.clearDatabaseHandlers();
	}
}