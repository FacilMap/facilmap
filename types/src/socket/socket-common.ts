import { mapSlugValidator, unitsValidator, type MapSlug } from "../base.js";
import { type TrackPoint } from "../line.js";
import * as z from "zod";
import { allMapObjectsPickValidator, type AllMapObjectsItem, type AllMapObjectsPick } from "../api/api-common.js";

// socket.io converts undefined to null, so if we send an event as undefined, it will arrive as null
export const nullOrUndefinedValidator = z.null().or(z.undefined()).transform((val) => val ?? null);

export const setLanguageRequestValidator = z.object({
	lang: z.string().optional(),
	units: unitsValidator.optional()
});
export type SetLanguageRequest = z.infer<typeof setLanguageRequestValidator>;

export type ReplaceProperty<T extends Record<keyof any, any>, Key extends keyof any, Value> = T extends Record<Key, any> ? (Omit<T, Key> & Record<Key, Value>) : T;

export type RenameProperty<T, From extends keyof any, To extends keyof any, KeepOld extends boolean = false> = T extends Record<From, any> ? (KeepOld extends true ? From : Omit<T, From>) & Record<To, T[From]> : T;

export function renameProperty<T, From extends keyof any, To extends keyof any, KeepOld extends boolean = false>(obj: T, from: From, to: To, keepOld?: KeepOld): RenameProperty<T, From, To, KeepOld> {
	if (from as any !== to as any && obj && typeof obj === "object" && from in obj && !(to in obj)) {
		const result = { ...obj } as any;
		result[to] = result[from];
		if (!keepOld) {
			delete result[from];
		}
		return result;
	} else {
		return obj as any;
	}
}

declare const streamType: unique symbol;
export type StreamId<R> = string & { [streamType]: R };

export type StreamToStreamId<T> = (
	T extends Uint8Array ? T :
	T extends AsyncIterable<infer R> | ReadableStream<infer R> ? StreamId<StreamToStreamId<R>> :
	T extends Promise<infer Value> ? Promise<StreamToStreamId<Value>> :
	T extends (...args: infer Args) => infer Result ? (...args: Args) => StreamToStreamId<Result> :
	T extends {} ? { [K in keyof T]: StreamToStreamId<T[K]> } :
	T
);

export const mapSubscriptionValidator = z.object({
	mapSlug: mapSlugValidator,

});

export const subscribeToMapPickValidator = allMapObjectsPickValidator.exclude(["linesWithTrackPoints"]);
export type SubscribeToMapPick = z.infer<typeof subscribeToMapPickValidator>;

export type SubscribeToMapItem = AllMapObjectsItem<Exclude<AllMapObjectsPick, "linesWithTrackPoints">>;

export type RoutePoints = { trackPoints: TrackPoint[] };

export type SetBboxItem = (
	| (AllMapObjectsItem<"markers" | "linePoints"> & { mapSlug: MapSlug })
	| { type: "routePoints"; data: AsyncIterable<RoutePoints> }
);