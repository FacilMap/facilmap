import { Bbox, bboxWithZoomValidator, exportFormatValidator, idValidator, objectWithIdValidator } from "./base.js";
import { PadData, padDataValidator } from "./padData.js";
import { Marker, markerValidator } from "./marker.js";
import { Line, lineValidator } from "./line.js";
import { Route, RouteInfo, lineToRouteCreateValidator, routeClearValidator, routeCreateValidator, routeRequestValidator } from "./route.js";
import { Type, typeValidator } from "./type.js";
import { View, viewValidator } from "./view.js";
import { MapEvents, MultipleEvents } from "./events.js";
import { SearchResult } from "./searchResult.js";
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

export const requestDataValidators = {
	updateBbox: bboxWithZoomValidator,
	getPad: getPadQueryValidator,
	findPads: findPadsQueryValidator,
	createPad: padDataValidator.create,
	editPad: padDataValidator.update,
	deletePad: z.void(),
	listenToHistory: z.void(),
	stopListeningToHistory: z.void(),
	revertHistoryEntry: objectWithIdValidator,
	getMarker: objectWithIdValidator,
	addMarker: markerValidator.create,
	editMarker: markerValidator.update,
	deleteMarker: objectWithIdValidator,
	getLineTemplate: lineTemplateRequestValidator,
	addLine: lineValidator.create,
	editLine: lineValidator.update,
	deleteLine: objectWithIdValidator,
	exportLine: lineExportRequestValidator,
	find: findQueryValidator,
	findOnMap: findOnMapQueryValidator,
	getRoute: routeRequestValidator,
	setRoute: routeCreateValidator,
	clearRoute: routeClearValidator.or(z.undefined()),
	lineToRoute: lineToRouteCreateValidator,
	exportRoute: routeExportRequestValidator,
	addType: typeValidator.create,
	editType: typeValidator.update,
	deleteType: objectWithIdValidator,
	addView: viewValidator.create,
	editView: viewValidator.update,
	deleteView: objectWithIdValidator,
	geoip: z.void(),
	setPadId: z.string()
}

type RawRequestDataMap = {
	[K in keyof typeof requestDataValidators]: z.infer<typeof requestDataValidators[K]>;
};
export interface RequestDataMap extends RawRequestDataMap {
}

export interface ResponseDataMap {
	updateBbox: MultipleEvents<MapEvents>;
	getPad: FindPadsResult | undefined;
	findPads: PagedResults<FindPadsResult>;
	createPad: MultipleEvents<MapEvents>;
	editPad: PadData;
	deletePad: void;
	listenToHistory: MultipleEvents<MapEvents>;
	stopListeningToHistory: void;
	revertHistoryEntry: MultipleEvents<MapEvents>;
	getMarker: Marker;
	addMarker: Marker;
	editMarker: Marker;
	deleteMarker: Marker;
	getLineTemplate: Line;
	addLine: Line;
	editLine: Line;
	deleteLine: Line;
	exportLine: string;
	find: string | SearchResult[];
	findOnMap: Array<FindOnMapResult>;
	getRoute: RouteInfo;
	setRoute: Route | undefined;
	clearRoute: void;
	lineToRoute: Route | undefined;
	exportRoute: string;
	addType: Type;
	editType: Type;
	deleteType: Type;
	addView: View;
	editView: View;
	deleteView: View;
	geoip: Bbox | null;
	setPadId: MultipleEvents<MapEvents>;
}

export type RequestName = keyof RequestDataMap;
export type RequestData<E extends RequestName> = RequestDataMap[E];
export type ResponseData<E extends RequestName> = ResponseDataMap[E];
