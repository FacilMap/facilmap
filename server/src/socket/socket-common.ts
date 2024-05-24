import { type DatabaseEvents } from "../database/database.js";
import { type EventHandler, type EventName, SocketVersion, type SocketApi, type StreamToStreamId } from "facilmap-types";

// Socket.io converts undefined to null. In socket handlers that allow a null response, let's also allow undefined.
type FixedNullResponse<T> = null extends T ? T | undefined | void : T;

export type SocketHandlers<V extends SocketVersion> = {
	[K in keyof SocketApi<V, true>]: SocketApi<V, true>[K] extends (...args: infer Args) => Promise<infer Ret> ? (...args: Args) => FixedNullResponse<StreamToStreamId<Ret>> | PromiseLike<FixedNullResponse<StreamToStreamId<Ret>>> : never;
};

export type DatabaseHandlers = {
	[eventName in EventName<Pick<DatabaseEvents, keyof DatabaseEvents>>]?: EventHandler<Pick<DatabaseEvents, keyof DatabaseEvents>, eventName>;
}

export interface SocketConnection<V extends SocketVersion> {
	getSocketHandlers(): SocketHandlers<V>;
	handleDisconnect(): void;
}