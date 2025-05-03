import * as z from "zod";
import type { MapData } from "../mapData.js";
import { bboxValidator, bboxWithZoomValidator, mapSlugOrJwtValidator, type ID, type MapSlug, type Stripped } from "../base.js";
import type { Line, TrackPoint } from "../line.js";
import type { Marker } from "../marker.js";
import type { Type } from "../type.js";
import type { View } from "../view.js";

export const anyMapSlugWithoutIdentityValidator = mapSlugOrJwtValidator.or(z.object({
	mapSlug: mapSlugOrJwtValidator,
	password: z.string().optional()
}));
export type AnyMapSlugWithoutIdentity = z.infer<typeof anyMapSlugWithoutIdentityValidator>;

export const anyMapSlugValidator = mapSlugOrJwtValidator.or(z.object({
	mapSlug: mapSlugOrJwtValidator,
	password: z.string().optional(),
	identity: z.string().optional()
}));
export type AnyMapSlug = z.infer<typeof anyMapSlugValidator>;

export const pagingValidator = z.object({
	start: z.coerce.number().int().min(0).default(() => 0),
	limit: z.coerce.number().int().min(1).max(200).default(() => 50)
});
export type PagingInput = z.input<typeof pagingValidator>;
export type Paging = z.infer<typeof pagingValidator>;
export const DEFAULT_PAGING = pagingValidator.parse({});

export type FindMapsResult = Pick<MapData, "id" | "name" | "description"> & { slug: MapSlug };

export interface PagedResults<T> {
	results: T[];
	totalLength: number;
}

export type StreamedResults<T> = {
	results: AsyncIterable<T, void, undefined>;
};

export type FindOnMapMarker = Pick<Marker, "id" | "name" | "typeId" | "lat" | "lon" | "icon" | "own"> & { kind: "marker"; similarity: number };
export type FindOnMapLine = Pick<Line, "id" | "name" | "typeId" | "left" | "top" | "right" | "bottom" | "own"> & { kind: "line"; similarity: number };
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

export type ExportResult = {
	type: string;
	filename: string;
	data: ReadableStream<Uint8Array>;
};

export const allMapObjectsPickValidator = z.enum(["mapData", "types", "views", "markers", "lines", "linesWithTrackPoints", "linePoints"]);
export type AllMapObjectsPick = z.infer<typeof allMapObjectsPickValidator>;

export type AllMapObjectsTypes = {
	mapData: { type: "mapData"; data: Stripped<MapData> };
	types: { type: "types", data: AsyncIterable<Stripped<Type>, void, undefined> };
	views: { type: "views", data: AsyncIterable<Stripped<View>, void, undefined> };
	markers: { type: "markers", data: AsyncIterable<Stripped<Marker>, void, undefined> };
	lines: { type: "lines", data: AsyncIterable<Stripped<Line>, void, undefined> };
	linesWithTrackPoints: { type: "lines", data: AsyncIterable<Stripped<LineWithTrackPoints>, void, undefined> };
	linePoints: { type: "linePoints", data: AsyncIterable<Stripped<LinePoints>, void, undefined> };
};

export type AllMapObjectsItem<Pick extends AllMapObjectsPick> = AllMapObjectsTypes[Pick];

export type GenericAllMapObjects<T extends AllMapObjectsTypes, Pick extends AllMapObjectsPick> = {
	[P in Pick as (["lines", "linesWithTrackPoints"] extends [P, Pick] ? never : T[P]["type"])]: T[P]["data"] extends AsyncIterable<infer I, any, any> ? I[] : T[P]["data"];
};

export type AllMapObjects<Pick extends AllMapObjectsPick> = GenericAllMapObjects<AllMapObjectsTypes, Pick>;

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