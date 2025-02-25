import * as z from "zod";
import { requestDataValidatorsV3, type ResponseDataMapV3, type MapEventsV3 } from "./socket-v3.js";
import { requestDataValidatorsV1, type MapEventsV1, type ResponseDataMapV1 } from "./socket-v1.js";
import { requestDataValidatorsV2, type MapEventsV2, type ResponseDataMapV2 } from "./socket-v2.js";

export * from "./socket-common.js";

export enum SocketVersion {
	V1 = "v1",
	V2 = "v2",
	V3 = "v3"
};

export const socketRequestValidators = {
	[SocketVersion.V1]: requestDataValidatorsV1,
	[SocketVersion.V2]: requestDataValidatorsV2,
	[SocketVersion.V3]: requestDataValidatorsV3
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
	[SocketVersion.V3]: ResponseDataMapV3;
}[V];

export type SocketEvents<V extends SocketVersion> = {
	[SocketVersion.V1]: Pick<MapEventsV1, keyof MapEventsV1>;
	[SocketVersion.V2]: Pick<MapEventsV2, keyof MapEventsV2>;
	[SocketVersion.V3]: Pick<MapEventsV3, keyof MapEventsV3>;
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
export type SocketServerToClientEmitArgs<V extends SocketVersion> = {
	[E in keyof SocketEvents<V>]: [e: E, ...args: SocketEvents<V>[E] extends Array<any> ? SocketEvents<V>[E] : never];
}[keyof SocketEvents<V>];