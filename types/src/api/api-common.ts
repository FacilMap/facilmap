import * as z from "zod";
import type { MapData, MapDataWithWritable, Writable } from "../mapData";
import { bboxValidator, bboxWithZoomValidator, type ID, type ReplaceProperties } from "../base";
import type { Line, TrackPoint } from "../line";
import type { Marker } from "../marker";
import type { Type } from "../type";
import type { View } from "../view";

export const pagingValidator = z.object({
	start: z.coerce.number().int().min(0).default(() => 0),
	limit: z.coerce.number().int().min(1).max(200).default(() => 50)
});
export type PagingInput = z.input<typeof pagingValidator>;
export type Paging = z.infer<typeof pagingValidator>;
export const DEFAULT_PAGING = pagingValidator.parse({});

export type FindMapsResult = Pick<MapData, "id" | "name" | "description">;

export interface PagedResults<T> {
	results: T[];
	totalLength: number;
}

export type StreamedResults<T> = {
	results: AsyncIterable<T>;
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
	types: { type: "types", data: AsyncIterable<Type> };
	views: { type: "views", data: AsyncIterable<View> };
	markers: { type: "markers", data: AsyncIterable<Marker> };
	lines: { type: "lines", data: AsyncIterable<Line> };
	linesWithTrackPoints: { type: "lines", data: AsyncIterable<LineWithTrackPoints> };
	linePoints: { type: "linePoints", data: AsyncIterable<LinePoints> };
};

export type AllMapObjectsItem<Pick extends AllMapObjectsPick> = (
	AllMapObjectsTypes[Pick]
);

export type AllAdminMapObjectsItem<Pick extends AllMapObjectsPick> = (
	ReplaceProperties<AllMapObjectsTypes, {
		mapData: { type: "mapData", data: Extract<MapDataWithWritable, { writable: Writable.ADMIN }> }
	}>[Pick]
);

export const stringifiedBooleanValidator = z.enum(["0", "1", "false", "true"]).transform((v) => ["true", "1"].includes(v));

export const bboxWithExceptValidator = bboxWithZoomValidator.extend({
	except: bboxValidator.optional()
});
export type BboxWithExcept = z.infer<typeof bboxWithExceptValidator>;