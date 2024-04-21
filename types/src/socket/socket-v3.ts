import { type Bbox, bboxWithZoomValidator, objectWithIdValidator, type ObjectWithId, idValidator } from "../base.js";
import { type MapData, mapDataValidator, Writable } from "../mapData.js";
import { type Marker, markerValidator } from "../marker.js";
import { type Line, lineValidator, type TrackPoint } from "../line.js";
import { type Route, type RouteInfo, lineToRouteCreateValidator, routeClearValidator, routeCreateValidator, routeRequestValidator } from "../route.js";
import { type Type, typeValidator } from "../type.js";
import { type View, viewValidator } from "../view.js";
import type { MultipleEvents } from "../events.js";
import type { SearchResult } from "../searchResult.js";
import * as z from "zod";
import { findMapsQueryValidator, getMapQueryValidator, type FindMapsResult, type PagedResults, type FindOnMapResult, lineTemplateRequestValidator, lineExportRequestValidator, findQueryValidator, findOnMapQueryValidator, routeExportRequestValidator, type LinePointsEvent, type RoutePointsEvent, nullOrUndefinedValidator, type LineTemplate, setLanguageRequestValidator } from "./socket-common.js";
import type { HistoryEntry } from "../historyEntry.js";

export const requestDataValidatorsV3 = {
	updateBbox: bboxWithZoomValidator,
	getMap: getMapQueryValidator,
	findMaps: findMapsQueryValidator,
	createMap: mapDataValidator.create,
	editMap: mapDataValidator.update,
	deleteMap: nullOrUndefinedValidator,
	listenToHistory: nullOrUndefinedValidator,
	stopListeningToHistory: nullOrUndefinedValidator,
	revertHistoryEntry: objectWithIdValidator,
	getMarker: objectWithIdValidator,
	addMarker: markerValidator.create,
	editMarker: markerValidator.update.extend({ id: idValidator }),
	deleteMarker: objectWithIdValidator,
	getLineTemplate: lineTemplateRequestValidator,
	addLine: lineValidator.create,
	editLine: lineValidator.update.extend({ id: idValidator }),
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
	editType: typeValidator.update.extend({ id: idValidator }),
	deleteType: objectWithIdValidator,
	addView: viewValidator.create,
	editView: viewValidator.update.extend({ id: idValidator }),
	deleteView: objectWithIdValidator,
	geoip: nullOrUndefinedValidator,
	setMapId: z.string(),
	setLanguage: setLanguageRequestValidator
};

export interface ResponseDataMapV3 {
	updateBbox: MultipleEvents<MapEventsV3>;
	getMap: FindMapsResult | null;
	findMaps: PagedResults<FindMapsResult>;
	createMap: MultipleEvents<MapEventsV3>;
	editMap: MapData & { writable: Writable };
	deleteMap: null;
	listenToHistory: MultipleEvents<MapEventsV3>;
	stopListeningToHistory: null;
	revertHistoryEntry: MultipleEvents<MapEventsV3>;
	getMarker: Marker;
	addMarker: Marker;
	editMarker: Marker;
	deleteMarker: Marker;
	getLineTemplate: LineTemplate;
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
	setMapId: MultipleEvents<MapEventsV3>;
	setLanguage: void;
}

export interface MapEventsV3Interface {
	mapData: [MapData & { writable: Writable }];
	deleteMap: [];
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

export type MapEventsV3 = Pick<MapEventsV3Interface, keyof MapEventsV3Interface>; // Workaround for https://github.com/microsoft/TypeScript/issues/15300