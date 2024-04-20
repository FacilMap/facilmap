import { exportFormatValidator, idValidator, unitsValidator, type Bbox, type ID } from "../base.js";
import { type MapData } from "../mapData.js";
import { type Marker } from "../marker.js";
import { type Line, type TrackPoint } from "../line.js";
import * as z from "zod";

export const getMapQueryValidator = z.object({
	padId: z.string()
});
export type GetMapQuery = z.infer<typeof getMapQueryValidator>;

export const findMapsQueryValidator = z.object({
	query: z.string(),
	start: z.number().optional(),
	limit: z.number().optional()
});
export type FindMapsQuery = z.infer<typeof findMapsQueryValidator>;

export type FindMapsResult = Pick<MapData, "id" | "name" | "description">;

export interface PagedResults<T> {
	results: T[];
	totalLength: number;
}

export const lineTemplateRequestValidator = z.object({
	typeId: idValidator
});
export type LineTemplateRequest = z.infer<typeof lineTemplateRequestValidator>;

export type LineTemplate = Omit<Line, "id" | "routePoints" | "extraInfo" | keyof Bbox | "distance" | "ascent" | "descent" | "time" | "padId">;

export const lineExportRequestValidator = z.object({
	id: idValidator,
	format: exportFormatValidator
});
export type LineExportRequest = z.infer<typeof lineExportRequestValidator>;

export const routeExportRequestValidator = z.object({
	format: exportFormatValidator,
	routeId: z.string().optional()
});
export type RouteExportRequest = z.infer<typeof routeExportRequestValidator>;

export const findQueryValidator = z.object({
	query: z.string(),
	loadUrls: z.boolean().optional()
});
export type FindQuery = z.infer<typeof findQueryValidator>;

export const findOnMapQueryValidator = z.object({
	query: z.string()
});
export type FindOnMapQuery = z.infer<typeof findOnMapQueryValidator>;

export type FindOnMapMarker = Pick<Marker, "id" | "name" | "typeId" | "lat" | "lon" | "icon"> & { kind: "marker"; similarity: number };
export type FindOnMapLine = Pick<Line, "id" | "name" | "typeId" | "left" | "top" | "right" | "bottom"> & { kind: "line"; similarity: number };
export type FindOnMapResult = FindOnMapMarker | FindOnMapLine;

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