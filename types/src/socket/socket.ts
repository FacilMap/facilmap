import * as z from "zod";
import { socketV3RequestValidators, type MapEventsV3, type SocketApiV3 } from "./socket-v3";
import { socketV1RequestValidators, type MapEventsV1, type SocketApiV1 } from "./socket-v1";
import { socketV2RequestValidators, type MapEventsV2, type SocketApiV2 } from "./socket-v2";
import type { StreamToStreamId } from "./socket-common";

export * from "./socket-common";

export enum SocketVersion {
	V1 = "v1",
	V2 = "v2",
	V3 = "v3"
};

export const socketRequestValidators = {
	[SocketVersion.V1]: socketV1RequestValidators,
	[SocketVersion.V2]: socketV2RequestValidators,
	[SocketVersion.V3]: socketV3RequestValidators
} satisfies Record<SocketVersion, Record<string, z.ZodType>>;

export type SocketEvents<V extends SocketVersion> = {
	[SocketVersion.V1]: Pick<MapEventsV1, keyof MapEventsV1>;
	[SocketVersion.V2]: Pick<MapEventsV2, keyof MapEventsV2>;
	[SocketVersion.V3]: Pick<MapEventsV3, keyof MapEventsV3>;
}[V];

export type SocketApi<V extends SocketVersion, Validated extends boolean> = {
	[SocketVersion.V1]: SocketApiV1<Validated>;
	[SocketVersion.V2]: SocketApiV2<Validated>;
	[SocketVersion.V3]: SocketApiV3<Validated>;
}[V];

export type SocketClientToServerEvents<V extends SocketVersion, Validated extends boolean> = {
	[E in keyof SocketApi<V, Validated>]: SocketApi<V, Validated>[E] extends (...args: any) => any ? ((
		...args: [
			...Parameters<SocketApi<V, Validated>[E]>,
			(err: Error | null, data: StreamToStreamId<Awaited<ReturnType<SocketApi<V, Validated>[E]>>>) => void
		]
	) => void) : never;
};

export type SocketServerToClientEvents<V extends SocketVersion> = {
	[E in keyof SocketEvents<V>]: (...args: SocketEvents<V>[E] extends Array<any> ? SocketEvents<V>[E] : never) => void;
};
export type SocketServerToClientEmitArgs<V extends SocketVersion> = {
	[E in keyof SocketEvents<V>]: [e: E, ...args: SocketEvents<V>[E] extends Array<any> ? SocketEvents<V>[E] : never];
}[keyof SocketEvents<V>];