import { type DatabaseEvents } from "../database/database.js";
import { type EventHandler, type EventName, SocketVersion, type SocketServerToClientEmitArgs, type SocketEvents, type MultipleEvents, type SocketApi } from "facilmap-types";

// Socket.io converts undefined to null. In socket handlers that allow a null response, let's also allow undefined.
type FixedNullResponse<T> = null extends T ? T | undefined | void : T;

export type SocketHandlers<V extends SocketVersion> = {
	[K in keyof SocketApi<V, true>]: SocketApi<V, true>[K] extends (...args: infer Args) => infer Ret ? (...args: Args) => FixedNullResponse<Ret> | PromiseLike<FixedNullResponse<Ret>> : never;
};

export type DatabaseHandlers = {
	[eventName in EventName<Pick<DatabaseEvents, keyof DatabaseEvents>>]?: EventHandler<Pick<DatabaseEvents, keyof DatabaseEvents>, eventName>;
}

export interface SocketConnection<V extends SocketVersion> {
	getSocketHandlers(): SocketHandlers<V>;
	handleDisconnect(): void;
}

export function mapMultipleEvents<VIn extends SocketVersion, VOut extends SocketVersion>(events: MultipleEvents<SocketEvents<VIn>>, mapper: (...args: SocketServerToClientEmitArgs<VIn>) => Array<SocketServerToClientEmitArgs<VOut>>): MultipleEvents<SocketEvents<VOut>> {
	const result: any = {};
	for (const [oldEventName, oldEvents] of Object.entries(events)) {
		for (const oldEvent of oldEvents) {
			for (const [newEventName, ...newEvent] of (mapper as any)(oldEventName, oldEvent)) {
				if (!result[newEventName]) {
					result[newEventName] = [];
				}
				result[newEventName].push(newEvent[0]);
			}
		}
	}
	return result;
}