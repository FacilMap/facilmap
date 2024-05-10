import { bboxWithZoomValidator, type ObjectWithId } from "../base.js";
import { type MapData, Writable } from "../mapData.js";
import { type Marker } from "../marker.js";
import { type Line, type TrackPoint } from "../line.js";
import { type Route, lineToRouteCreateValidator, routeClearValidator, routeCreateValidator } from "../route.js";
import { type Type } from "../type.js";
import { type View } from "../view.js";
import type { MultipleEvents } from "../events.js";
import * as z from "zod";
import { routeExportRequestValidator, type LinePointsEvent, type RoutePointsEvent, nullOrUndefinedValidator, setLanguageRequestValidator, type StreamId, type StreamToStreamId } from "./socket-common.js";
import type { HistoryEntry } from "../historyEntry.js";
import { apiV3RequestValidators, type ApiV3 } from "../api/api-v3.js";

export const socketV3RequestValidators = {
	...apiV3RequestValidators,

	updateBbox: z.tuple([bboxWithZoomValidator]),
	listenToHistory: z.tuple([nullOrUndefinedValidator]),
	stopListeningToHistory: z.tuple([nullOrUndefinedValidator]),
	setMapId: z.tuple([z.string()]),
	setLanguage: z.tuple([setLanguageRequestValidator]),
	setRoute: z.tuple([routeCreateValidator]),
	clearRoute: z.tuple([routeClearValidator.or(nullOrUndefinedValidator)]),
	lineToRoute: z.tuple([lineToRouteCreateValidator]),
	exportRoute: z.tuple([routeExportRequestValidator]),
};

export interface SocketV3Response {
	updateBbox: MultipleEvents<MapEventsV3>;
	listenToHistory: MultipleEvents<MapEventsV3>;
	stopListeningToHistory: null;
	setMapId: MultipleEvents<MapEventsV3>;
	setLanguage: void;
	setRoute: Route | null;
	clearRoute: null;
	lineToRoute: Route | null;
	exportRoute: string;
}

export type SocketApiV3<Validated extends boolean = false> = StreamToStreamId<ApiV3<Validated> & {
	[K in keyof SocketV3Response]: (...args: Validated extends true ? z.infer<typeof socketV3RequestValidators[K]> : z.input<typeof socketV3RequestValidators[K]>) => Promise<SocketV3Response[K]>;
}>;

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
	streamChunks: [{ streamId: StreamId; chunks: any[] }];
	streamDone: [{ streamId: StreamId }];
}

export type MapEventsV3 = Pick<MapEventsV3Interface, keyof MapEventsV3Interface>; // Workaround for https://github.com/microsoft/TypeScript/issues/15300