import * as z from "zod";
import type { MapData, MapDataWithWritable, Writable } from "../mapData.js";
import { bboxValidator, bboxWithZoomValidator, type ID } from "../base.js";
import type { Line, TrackPoint } from "../line.js";
import type { Marker } from "../marker.js";
import type { Type } from "../type.js";
import type { View } from "../view.js";
import type { ReplaceProperties } from "../utility.js";

export const pagingValidator = z.object({
	start: z.coerce.number().int().min(0).default(() => 0),
	limit: z.coerce.number().int().min(1).max(200).default(() => 50)
});
export type PagingInput = z.input<typeof pagingValidator>;
export type Paging = z.infer<typeof pagingValidator>;
export const DEFAULT_PAGING = pagingValidator.parse({});

export type FindMapsResult = Pick<MapData, "id" | "readId" | "name" | "description">;

export interface PagedResults<T> {
	results: T[];
	totalLength: number;
}

export type StreamedResults<T> = {
	results: AsyncIterable<T, void, undefined>;
};

export type FindOnMapMarker = Pick<Marker, "id" | "name" | "typeId" | "lat" | "lon" | "icon"> & { kind: "marker"; similarity: number };
export type FindOnMapLine = Pick<Line, "id" | "name" | "typeId" | "left" | "top" | "right" | "bottom"> & { kind: "line"; similarity: number };
export type FindOnMapResult = FindOnMapMarker | FindOnMapLine;

export type TrackPoints = {
	[idx: number]: TrackPoint;
	length: number;
};

export type LineWithTrackPoints = Line & {
	trackPoints: TrackPoints;
};

export type LinePoints = {
	lineId: ID;
	trackPoints: TrackPoint[];
}

export const allMapObjectsPickValidator = z.enum(["mapData", "types", "views", "markers", "lines", "linesWithTrackPoints", "linePoints"]);
export type AllMapObjectsPick = z.infer<typeof allMapObjectsPickValidator>;

export type AllMapObjectsTypes = {
	mapData: { type: "mapData"; data: MapDataWithWritable };
	types: { type: "types", data: AsyncIterable<Type, void, undefined> };
	views: { type: "views", data: AsyncIterable<View, void, undefined> };
	markers: { type: "markers", data: AsyncIterable<Marker, void, undefined> };
	lines: { type: "lines", data: AsyncIterable<Line, void, undefined> };
	linesWithTrackPoints: { type: "lines", data: AsyncIterable<LineWithTrackPoints, void, undefined> };
	linePoints: { type: "linePoints", data: AsyncIterable<LinePoints, void, undefined> };
};

export type AllAdminMapObjectsTypes = ReplaceProperties<AllMapObjectsTypes, {
	mapData: { type: "mapData", data: Extract<MapDataWithWritable, { writable: Writable.ADMIN }> }
}>;

export type AllMapObjectsItem<Pick extends AllMapObjectsPick> = AllMapObjectsTypes[Pick];

export type AllAdminMapObjectsItem<Pick extends AllMapObjectsPick> = AllAdminMapObjectsTypes[Pick];

export type GenericAllMapObjects<T extends AllMapObjectsTypes, Pick extends AllMapObjectsPick> = {
	[P in Pick as (["lines", "linesWithTrackPoints"] extends [P, Pick] ? never : T[P]["type"])]: T[P]["data"] extends AsyncIterable<infer I, any, any> ? I[] : T[P]["data"];
};

export type AllMapObjects<Pick extends AllMapObjectsPick> = GenericAllMapObjects<AllMapObjectsTypes, Pick>;

export type AllAdminMapObjects<Pick extends AllMapObjectsPick> = GenericAllMapObjects<AllAdminMapObjectsTypes, Pick>;

export const stringifiedBooleanValidator = z.enum(["0", "1", "false", "true"]).transform((v) => ["true", "1"].includes(v));

export const bboxWithExceptValidator = bboxWithZoomValidator.extend({
	except: bboxValidator.optional()
});
export type BboxWithExcept = z.infer<typeof bboxWithExceptValidator>;

/**
 * Returns an optional zod type that transforms null to undefined. This can be used for socket.io method parameters, as socket.io will convert
 * undefined to null.
 */
export function optionalParam<T extends z.ZodTypeAny>(type: T): z.ZodOptional<z.ZodEffects<z.ZodUnion<[T, z.ZodNull]>, z.output<T> extends null ? undefined : z.output<T>, z.input<T>>> {
	return type.or(z.null()).transform((v) => v == null ? undefined : v).optional();
}