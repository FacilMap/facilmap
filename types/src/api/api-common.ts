import * as z from "zod";
import type { MapData, Writable } from "../mapData";
import { bboxValidator, bboxWithZoomValidator, type ID, type ReplaceProperties } from "../base";
import type { Line, TrackPoint } from "../line";
import type { Marker } from "../marker";
import type { Type } from "../type";
import type { View } from "../view";

export const pagingValidator = z.object({
	start: z.coerce.number().int().min(0).optional(),
	limit: z.coerce.number().int().min(1).optional()
});
export type Paging = z.infer<typeof pagingValidator>;

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

export interface TrackPoints {
	[idx: number]: TrackPoint;
	length: number;
}

export interface LineWithTrackPoints extends Line {
	trackPoints: TrackPoints;
}

export type LinePoints = {
	lineId: ID;
	trackPoints: TrackPoint[];
}

export type MapDataWithWritable = (
	| { writable: Writable.ADMIN } & MapData
	| { writable: Writable.WRITE } & Omit<MapData, "adminId">
	| { writable: Writable.READ } & Omit<MapData, "adminId" | "writeId">
);

export const allMapObjectsPickValidator = z.enum(["mapData", "types", "views", "markers", "lines", "linesWithTrackPoints", "linePoints"]);
export type AllMapObjectsPick = z.infer<typeof allMapObjectsPickValidator>;

export type AllMapObjectsTypes = {
	mapData: ["mapData", MapDataWithWritable];
	types: ["type", Type];
	views: ["view", View];
	markers: ["marker", Marker];
	lines: ["line", Line];
	linesWithTrackPoints: ["line", LineWithTrackPoints];
	linePoints: ["linePoints", LinePoints];
};

export type AllMapObjectsItem<Pick extends AllMapObjectsPick> = (
	AllMapObjectsTypes[Pick]
);

export type AllAdminMapObjectsItem<Pick extends AllMapObjectsPick> = (
	ReplaceProperties<AllMapObjectsTypes, {
		mapData: ["mapData", Extract<MapDataWithWritable, { writable: Writable.ADMIN }>]
	}>[Pick]
);

export const stringifiedBooleanValidator = z.enum(["0", "1", "false", "true"]).transform((v) => ["true", "1"].includes(v));

export const bboxWithExceptValidator = bboxWithZoomValidator.extend({
	except: bboxValidator.optional()
});
export type BboxWithExcept = z.infer<typeof bboxWithExceptValidator>;