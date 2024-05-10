import { exportFormatValidator, unitsValidator, type ID } from "../base.js";
import { type TrackPoint } from "../line.js";
import * as z from "zod";

export const routeExportRequestValidator = z.object({
	format: exportFormatValidator,
	routeId: z.string().optional()
});
export type RouteExportRequest = z.infer<typeof routeExportRequestValidator>;

export interface LinePointsEvent {
	id: ID;
	reset?: boolean;
	trackPoints: TrackPoint[];
}

export interface RoutePointsEvent {
	routeId: string;
	trackPoints: TrackPoint[];
}

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

type ReplacePropertyIfNotUndefined<T extends Record<keyof any, any>, Key extends keyof any, Value> = T[Key] extends undefined ? T : ReplaceProperty<T, Key, Value>;
export function mapHistoryEntry<Obj extends { objectBefore?: any; objectAfter?: any }, Out>(entry: Obj, mapper: (obj: (Obj extends { objectBefore: {} } ? Obj["objectBefore"] : never) | (Obj extends { objectAfter: {} } ? Obj["objectAfter"] : never)) => Out): ReplacePropertyIfNotUndefined<ReplacePropertyIfNotUndefined<Obj, "objectBefore", Out>, "objectAfter", Out> {
	return {
		...entry,
		..."objectBefore" in entry && entry.objectBefore !== undefined ? { objectBefore: mapper(entry.objectBefore) } : {},
		..."objectAfter" in entry && entry.objectAfter !== undefined ? { objectAfter: mapper(entry.objectAfter) } : {}
	} as any;
}

export type StreamId = string;

export type StreamToStreamId<T> = (
	T extends AsyncIterable<any> | ReadableStream<any> ? StreamId :
	T extends Promise<infer Value> ? Promise<StreamToStreamId<Value>> :
	T extends (...args: infer Args) => infer Result ? (...args: Args) => StreamToStreamId<Result> :
	{ [K in keyof T]: StreamToStreamId<T[K]> }
);