import { bboxWithZoomValidator, exportFormatValidator, mapSlugValidator, type MapSlug, type ObjectWithId } from "../base.js";
import { type MapDataWithWritable } from "../mapData.js";
import { type Marker } from "../marker.js";
import { type Line } from "../line.js";
import { lineToRouteRequestValidator, routeParametersValidator, type Route } from "../route.js";
import { type Type } from "../type.js";
import { type View } from "../view.js";
import * as z from "zod";
import { setLanguageRequestValidator, type StreamId, subscribeToMapPickValidator, type SetBboxItem, type SubscribeToMapItem } from "./socket-common.js";
import type { HistoryEntry } from "../historyEntry.js";
import { apiV3RequestValidators, type ApiV3 } from "../api/api-v3.js";
import { optionalParam, type LinePoints } from "../api/api-common.js";

export const socketV3RequestValidators = {
	...apiV3RequestValidators,

	subscribeToMap: z.union([
		// Optional tuple parameters are not supported in zod yet, see https://github.com/colinhacks/zod/issues/149
		z.tuple([mapSlugValidator]),
		z.tuple([mapSlugValidator, optionalParam(z.object({ pick: z.array(subscribeToMapPickValidator).optional(), history: z.boolean().optional() }))])
	]),
	unsubscribeFromMap: z.tuple([mapSlugValidator]),
	subscribeToRoute: z.tuple([z.string(), z.union([routeParametersValidator, lineToRouteRequestValidator])]),
	unsubscribeFromRoute: z.tuple([z.string()]),
	exportRoute: z.tuple([z.string(), z.object({ format: exportFormatValidator })]),
	setBbox: z.tuple([bboxWithZoomValidator]),
	setLanguage: z.tuple([setLanguageRequestValidator])
};

export interface SocketV3Response {
	subscribeToMap: AsyncIterable<SubscribeToMapItem>;
	unsubscribeFromMap: void;
	subscribeToRoute: Omit<Route, "routeId"> | undefined;
	unsubscribeFromRoute: void;
	exportRoute: Awaited<ReturnType<ApiV3<true>["exportLine"]>>;
	setBbox: AsyncIterable<SetBboxItem>;
	setLanguage: void;
}

export type SocketApiV3<Validated extends boolean = false> = ApiV3<Validated> & {
	[K in keyof SocketV3Response]: (...args: Validated extends true ? z.infer<typeof socketV3RequestValidators[K]> : z.input<typeof socketV3RequestValidators[K]>) => Promise<SocketV3Response[K]>;
};

export interface MapEventsV3Interface {
	mapData: [MapSlug, MapDataWithWritable];
	mapSlugRename: [Record<MapSlug, MapSlug>];
	deleteMap: [MapSlug];
	marker: [MapSlug, Marker];
	deleteMarker: [MapSlug, ObjectWithId];
	line: [MapSlug, Line];
	deleteLine: [MapSlug, ObjectWithId];
	linePoints: [MapSlug, LinePoints];
	view: [MapSlug, View];
	deleteView: [MapSlug, ObjectWithId];
	type: [MapSlug, Type];
	deleteType: [MapSlug, ObjectWithId];
	history: [MapSlug, HistoryEntry];
	streamChunks: [StreamId<any>, chunks: any[]];
	streamDone: [StreamId<any>];
	streamError: [StreamId<any>, error: Error];
}

export type MapEventsV3 = Pick<MapEventsV3Interface, keyof MapEventsV3Interface>; // Workaround for https://github.com/microsoft/TypeScript/issues/15300