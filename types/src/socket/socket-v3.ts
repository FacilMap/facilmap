import { bboxWithZoomValidator, mapSlugValidator, type MapSlug, type ObjectWithId, type Stripped } from "../base.js";
import { mapDataValidator, type MapData } from "../mapData.js";
import { type Marker } from "../marker.js";
import { type Line } from "../line.js";
import { lineToRouteRequestValidator, routeParametersValidator, type Route } from "../route.js";
import { type Type } from "../type.js";
import { type View } from "../view.js";
import * as z from "zod";
import { setLanguageRequestValidator, type StreamId, subscribeToMapPickValidator, type RoutePoints } from "./socket-common.js";
import type { HistoryEntry } from "../historyEntry.js";
import { apiV3RequestValidators, type ApiV3 } from "../api/api-v3.js";
import { anyMapSlugWithoutIdentityValidator, optionalParam, type ExportResult, type LinePoints } from "../api/api-common.js";
import type { DeepReadonly } from "../utility.js";
import { tupleWithOptional } from "zod-tuple-with-optional";

export const subscribeToMapOptionsValidator = z.object({
	pick: z.array(subscribeToMapPickValidator).optional(),
	history: z.boolean().optional(),
	identity: z.string().optional()
});
export type SubscribeToMapOptions = z.infer<typeof subscribeToMapOptionsValidator>;

export const subscribeToRouteOptionsValidator = z.union([routeParametersValidator, lineToRouteRequestValidator]);
export type SubscribeToRouteOptions = z.infer<typeof subscribeToRouteOptionsValidator>;

export const socketV3RequestValidators = {
	...apiV3RequestValidators,

	subscribeToMap: tupleWithOptional([anyMapSlugWithoutIdentityValidator, optionalParam(subscribeToMapOptionsValidator)]),
	createMapAndSubscribe: tupleWithOptional([mapDataValidator.create, optionalParam(subscribeToMapOptionsValidator)]),
	unsubscribeFromMap: z.tuple([mapSlugValidator]),
	subscribeToRoute: z.tuple([z.string(), subscribeToRouteOptionsValidator]),
	unsubscribeFromRoute: z.tuple([z.string()]),
	exportRouteAsGpx: tupleWithOptional([z.string(), optionalParam(z.object({ rte: z.boolean().optional() }))]),
	exportRouteAsGeoJson: tupleWithOptional([z.string()]),
	setBbox: z.tuple([bboxWithZoomValidator]),
	setLanguage: z.tuple([setLanguageRequestValidator]),
	abortStream: z.tuple([z.string()])
};

export interface SocketV3Response {
	createMapAndSubscribe: void;
	subscribeToMap: void;
	unsubscribeFromMap: void;
	subscribeToRoute: void;
	unsubscribeFromRoute: void;
	exportRouteAsGpx: ExportResult;
	exportRouteAsGeoJson: ExportResult;
	setBbox: void;
	setLanguage: void;
	abortStream: void;
}

type DeepReadonlyParams<T extends [...any[]]> = { [K in keyof T]: DeepReadonly<T[K]>; };
export type SocketApiV3<Validated extends boolean = false> = ApiV3<Validated> & {
	[K in keyof SocketV3Response]: (...args: DeepReadonlyParams<Validated extends true ? z.infer<typeof socketV3RequestValidators[K]> : z.input<typeof socketV3RequestValidators[K]>>) => Promise<SocketV3Response[K]>;
};

export interface MapEventsV3Interface {
	mapData: [MapSlug, Stripped<MapData>];
	deleteMap: [MapSlug];
	cancelMapSubscription: [MapSlug, Error & { status?: number }];
	marker: [MapSlug, Stripped<Marker>];
	deleteMarker: [MapSlug, Stripped<ObjectWithId>];
	line: [MapSlug, Stripped<Line>];
	deleteLine: [MapSlug, Stripped<ObjectWithId>];
	linePoints: [MapSlug, Stripped<LinePoints & { reset: boolean }>];
	view: [MapSlug, Stripped<View>];
	deleteView: [MapSlug, ObjectWithId];
	type: [MapSlug, Stripped<Type>];
	deleteType: [MapSlug, ObjectWithId];
	history: [MapSlug, Stripped<HistoryEntry>];

	route: [string, Route];
	routePoints: [string, RoutePoints & { reset: boolean }];

	streamChunks: [StreamId<any>, chunks: any[]];
	streamDone: [StreamId<any>];
	streamError: [StreamId<any>, error: Error];
}

export type MapEventsV3 = Pick<MapEventsV3Interface, keyof MapEventsV3Interface>; // Workaround for https://github.com/microsoft/TypeScript/issues/15300