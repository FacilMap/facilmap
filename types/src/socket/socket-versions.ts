import { type Bbox, bboxWithZoomValidator, objectWithIdValidator, type ObjectWithId } from "../base.js";
import { type PadData, padDataValidator, Writable } from "../padData.js";
import { type Marker, markerValidator } from "../marker.js";
import { type Line, lineValidator, type TrackPoint } from "../line.js";
import { type Route, type RouteInfo, lineToRouteCreateValidator, routeClearValidator, routeCreateValidator, routeRequestValidator } from "../route.js";
import { type Type, typeValidator } from "../type.js";
import { type View, viewValidator } from "../view.js";
import type { MultipleEvents } from "../events.js";
import type { SearchResult } from "../searchResult.js";
import * as z from "zod";
import { findPadsQueryValidator, getPadQueryValidator, type FindPadsResult, type PagedResults, type FindOnMapResult, lineTemplateRequestValidator, lineExportRequestValidator, findQueryValidator, findOnMapQueryValidator, routeExportRequestValidator, type LinePointsEvent, type RoutePointsEvent, nullOrUndefinedValidator } from "./socket-common";
import type { HistoryEntry } from "../historyEntry";

export const requestDataValidatorsV2 = {
	updateBbox: bboxWithZoomValidator,
	getPad: getPadQueryValidator,
	findPads: findPadsQueryValidator,
	createPad: padDataValidator.create,
	editPad: padDataValidator.update,
	deletePad: nullOrUndefinedValidator,
	listenToHistory: nullOrUndefinedValidator,
	stopListeningToHistory: nullOrUndefinedValidator,
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
	clearRoute: routeClearValidator.or(nullOrUndefinedValidator),
	lineToRoute: lineToRouteCreateValidator,
	exportRoute: routeExportRequestValidator,
	addType: typeValidator.create,
	editType: typeValidator.update,
	deleteType: objectWithIdValidator,
	addView: viewValidator.create,
	editView: viewValidator.update,
	deleteView: objectWithIdValidator,
	geoip: nullOrUndefinedValidator,
	setPadId: z.string()
};

export interface ResponseDataMapV2 {
	updateBbox: MultipleEvents<MapEventsV2>;
	getPad: FindPadsResult | null;
	findPads: PagedResults<FindPadsResult>;
	createPad: MultipleEvents<MapEventsV2>;
	editPad: PadData & { writable: Writable };
	deletePad: null;
	listenToHistory: MultipleEvents<MapEventsV2>;
	stopListeningToHistory: null;
	revertHistoryEntry: MultipleEvents<MapEventsV2>;
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
	setRoute: Route | null;
	clearRoute: null;
	lineToRoute: Route | null;
	exportRoute: string;
	addType: Type;
	editType: Type;
	deleteType: Type;
	addView: View;
	editView: View;
	deleteView: View;
	geoip: Bbox | null;
	setPadId: MultipleEvents<MapEventsV2>;
}

export interface MapEventsV2 {
	padData: [PadData & { writable: Writable }];
	deletePad: [];
	marker: [Marker];
	deleteMarker: [ObjectWithId];
	line: [Line];
	deleteLine: [ObjectWithId];
	linePoints: [LinePointsEvent];
	routePoints: [TrackPoint[]];
	routePointsWithId: [RoutePointsEvent];
	view: [View];
	deleteView: [ObjectWithId];
	type: [Type];
	deleteType: [ObjectWithId];
	history: [HistoryEntry];
}


// Socket v1:
// - Marker name, line name and pad name is never an empty string but defaults to "Untitled marker", "Untitled line" and "Unnamed map"

export const requestDataValidatorsV1 = requestDataValidatorsV2;
export type ResponseDataMapV1 = ResponseDataMapV2;
export type MapEventsV1 = MapEventsV2;
