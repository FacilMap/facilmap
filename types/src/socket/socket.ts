import * as z from "zod";
import { socketV3RequestValidators, type SocketEventsV3, type SocketApiV3 } from "./socket-v3.js";
import { socketV1RequestValidators, type SocketEventsV1, type SocketApiV1 } from "./socket-v1.js";
import { socketV2RequestValidators, type SocketEventsV2, type SocketApiV2 } from "./socket-v2.js";
import type { StreamToStreamId } from "./socket-common.js";

export * from "./socket-common.js";

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
	[SocketVersion.V1]: SocketEventsV1;
	[SocketVersion.V2]: SocketEventsV2;
	[SocketVersion.V3]: SocketEventsV3;
}[V];

export type SocketEventWithName<V extends SocketVersion> = {
	[E in keyof SocketEvents<V>]: SocketEvents<V>[E] extends any[] ? [E, ...SocketEvents<V>[E]] : never;
}[keyof SocketEvents<V>];

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

export type SocketServerToClientEvents<V extends SocketVersion> = (
	V extends SocketVersion.V1 | SocketVersion.V2 ? {
		[E in keyof SocketEvents<V>]: (...args: SocketEvents<V>[E] extends Array<any> ? SocketEvents<V>[E] : never) => void;
	} : {
		events: (events: Array<SocketEventWithName<V>>) => void;
	}
);
export type SocketServerToClientEmitArgs<V extends SocketVersion> = {
	[E in keyof SocketServerToClientEvents<V>]: SocketServerToClientEvents<V>[E] extends (...args: any) => any ? [e: E, ...args: Parameters<SocketServerToClientEvents<V>[E]>] : never;
}[keyof SocketServerToClientEvents<V>];