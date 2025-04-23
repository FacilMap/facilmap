import { bboxWithZoomValidator, exportFormatValidator, mapSlugValidator, type MapSlug, type ObjectWithId } from "../base.js";
import { mapDataValidator, type MapData } from "../mapData.js";
import { type Marker } from "../marker.js";
import { type Line } from "../line.js";
import { lineToRouteRequestValidator, routeParametersValidator, type Route } from "../route.js";
import { type Type } from "../type.js";
import { type View } from "../view.js";
import * as z from "zod";
import { setLanguageRequestValidator, type StreamId, subscribeToMapPickValidator, type RoutePoints } from "./socket-common.js";
import type { HistoryEntry } from "../historyEntry.js";
import { anyMapSlugValidator, apiV3RequestValidators, type ApiV3 } from "../api/api-v3.js";
import { optionalParam, type LinePoints } from "../api/api-common.js";
import type { DeepReadonly } from "../utility.js";

export const subscribeToMapOptionsValidator = z.object({
	pick: z.array(subscribeToMapPickValidator).optional(),
	history: z.boolean().optional()
});
export type SubscribeToMapOptions = z.infer<typeof subscribeToMapOptionsValidator>;

export const subscribeToRouteOptionsValidator = z.union([routeParametersValidator, lineToRouteRequestValidator]);
export type SubscribeToRouteOptions = z.infer<typeof subscribeToRouteOptionsValidator>;

export const socketV3RequestValidators = {
	...apiV3RequestValidators,

	subscribeToMap: z.union([
		// Optional tuple parameters are not supported in zod yet, see https://github.com/colinhacks/zod/issues/149
		z.tuple([anyMapSlugValidator]),
		z.tuple([anyMapSlugValidator, optionalParam(subscribeToMapOptionsValidator)])
	]),
	createMapAndSubscribe: z.union([
		z.tuple([mapDataValidator.create,]),
		z.tuple([mapDataValidator.create, optionalParam(subscribeToMapOptionsValidator)])
	]),
	unsubscribeFromMap: z.tuple([mapSlugValidator]),
	subscribeToRoute: z.tuple([z.string(), subscribeToRouteOptionsValidator]),
	unsubscribeFromRoute: z.tuple([z.string()]),
	exportRoute: z.tuple([z.string(), z.object({ format: exportFormatValidator })]),
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
	exportRoute: Awaited<ReturnType<ApiV3<true>["exportLine"]>>;
	setBbox: void;
	setLanguage: void;
	abortStream: void;
}

type DeepReadonlyParams<T extends [...any[]]> = { [K in keyof T]: DeepReadonly<T[K]>; };
export type SocketApiV3<Validated extends boolean = false> = ApiV3<Validated> & {
	[K in keyof SocketV3Response]: (...args: DeepReadonlyParams<Validated extends true ? z.infer<typeof socketV3RequestValidators[K]> : z.input<typeof socketV3RequestValidators[K]>>) => Promise<SocketV3Response[K]>;
};

export interface MapEventsV3Interface {
	mapData: [MapSlug, MapData];
	mapSlugRename: [Record<MapSlug, MapSlug>];
	deleteMap: [MapSlug];
	marker: [MapSlug, Marker];
	deleteMarker: [MapSlug, ObjectWithId];
	line: [MapSlug, Line];
	deleteLine: [MapSlug, ObjectWithId];
	linePoints: [MapSlug, LinePoints & { reset: boolean }];
	view: [MapSlug, View];
	deleteView: [MapSlug, ObjectWithId];
	type: [MapSlug, Type];
	deleteType: [MapSlug, ObjectWithId];
	history: [MapSlug, HistoryEntry];

	route: [string, Route];
	routePoints: [string, RoutePoints & { reset: boolean }];

	streamChunks: [StreamId<any>, chunks: any[]];
	streamDone: [StreamId<any>];
	streamError: [StreamId<any>, error: Error];
}

export type MapEventsV3 = Pick<MapEventsV3Interface, keyof MapEventsV3Interface>; // Workaround for https://github.com/microsoft/TypeScript/issues/15300