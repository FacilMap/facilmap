import { exportFormatValidator, idValidator, type ID } from "../base.js";
import { type PadData } from "../padData.js";
import { type Marker } from "../marker.js";
import { type Line, type TrackPoint } from "../line.js";
import * as z from "zod";

export const getPadQueryValidator = z.object({
	padId: z.string()
});
export type GetPadQuery = z.infer<typeof getPadQueryValidator>;

export const findPadsQueryValidator = z.object({
	query: z.string(),
	start: z.number().optional(),
	limit: z.number().optional()
});
export type FindPadsQuery = z.infer<typeof findPadsQueryValidator>;

export type FindPadsResult = Pick<PadData, "id" | "name" | "description">;

export interface PagedResults<T> {
	results: T[];
	totalLength: number;
}

export const lineTemplateRequestValidator = z.object({
	typeId: idValidator
});
export type LineTemplateRequest = z.infer<typeof lineTemplateRequestValidator>;

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
	loadUrls: z.boolean().optional(),
	elevation: z.boolean().optional()
});
export type FindQuery = z.infer<typeof findQueryValidator>;

export const findOnMapQueryValidator = z.object({
	query: z.string()
});
export type FindOnMapQuery = z.infer<typeof findOnMapQueryValidator>;

export type FindOnMapMarker = Pick<Marker, "id" | "name" | "typeId" | "lat" | "lon" | "symbol"> & { kind: "marker"; similarity: number };
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
