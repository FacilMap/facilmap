import * as z from "zod";
import { requestDataValidatorsV1, requestDataValidatorsV2, type MapEventsV1, type ResponseDataMapV1, type ResponseDataMapV2, type MapEventsV2 } from "./socket-versions";

export * from "./socket-common";

export enum SocketVersion {
	V1 = "v1",
	V2 = "v2"
};

export const socketRequestValidators = {
	[SocketVersion.V1]: requestDataValidatorsV1,
	[SocketVersion.V2]: requestDataValidatorsV2
} satisfies Record<SocketVersion, Record<string, z.ZodType>>;

type SocketRequestMap<V extends SocketVersion> = {
	[E in keyof typeof socketRequestValidators[V]]: typeof socketRequestValidators[V][E] extends z.ZodType ? z.input<typeof socketRequestValidators[V][E]> : never;
};

type ValidatedSocketRequestMap<V extends SocketVersion> = {
	[E in keyof typeof socketRequestValidators[V]]: typeof socketRequestValidators[V][E] extends z.ZodType ? z.output<typeof socketRequestValidators[V][E]> : never;
};

type SocketResponseMap<V extends SocketVersion> = {
	[SocketVersion.V1]: ResponseDataMapV1;
	[SocketVersion.V2]: ResponseDataMapV2;
}[V];

export type SocketEvents<V extends SocketVersion> = {
	[SocketVersion.V1]: MapEventsV1;
	[SocketVersion.V2]: MapEventsV2;
}[V];

export type SocketRequestName<V extends SocketVersion> = keyof typeof socketRequestValidators[V];
export type SocketRequest<V extends SocketVersion, E extends SocketRequestName<V>> = SocketRequestMap<V>[E];
export type ValidatedSocketRequest<V extends SocketVersion, E extends SocketRequestName<V>> = ValidatedSocketRequestMap<V>[E];
export type SocketResponse<V extends SocketVersion, E extends SocketRequestName<V>> = E extends keyof SocketResponseMap<V> ? SocketResponseMap<V>[E] : never;

export type SocketClientToServerEvents<V extends SocketVersion> = {
	[E in keyof SocketRequestMap<V>]: (
		data: SocketRequestMap<V>[E],
		callback: E extends keyof SocketResponseMap<V> ? (err: Error | null, data: SocketResponseMap<V>[E]) => void : (err: Error | null) => void
	) => void;
};

export type SocketServerToClientEvents<V extends SocketVersion> = {
	[E in keyof SocketEvents<V>]: (...args: SocketEvents<V>[E] extends Array<any> ? SocketEvents<V>[E] : never) => void;
};