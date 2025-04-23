import { mapDataValidator, mapPermissionsValidator, type MapData } from "../mapData.js";
import { bboxWithZoomValidator, exportFormatValidator, idValidator, mapSlugOrJwtValidator, type Bbox, type BboxWithZoom, type ID, type MapSlug } from "../base.js";
import type { CRU } from "../cru.js";
import { lineValidator, type Line, type LineTemplate, type TrackPoint } from "../line.js";
import type { SearchResult } from "../searchResult.js";
import { markerValidator, type Marker } from "../marker.js";
import { routeRequestValidator, type RouteInfo } from "../route.js";
import { typeValidator, type Type } from "../type.js";
import { viewValidator, type View } from "../view.js";
import type { HistoryEntry } from "../historyEntry.js";
import { allMapObjectsPickValidator, bboxWithExceptValidator, optionalParam, pagingValidator, type AllAdminMapObjectsItem, type AllMapObjectsItem, type AllMapObjectsPick, type BboxWithExcept, type FindMapsResult, type FindOnMapResult, type LineWithTrackPoints, type PagedResults, type StreamedResults } from "./api-common.js";
import * as z from "zod";

export const anyMapSlugValidator = mapSlugOrJwtValidator.or(z.object({
	mapSlug: mapSlugOrJwtValidator,
	password: z.string().optional()
}));
export type AnyMapSlug = z.infer<typeof anyMapSlugValidator>;


export const apiV3RequestValidators = {
	findMaps: z.union([
		// Optional tuple parameters are not supported in zod yet, see https://github.com/colinhacks/zod/issues/149
		z.tuple([/** query */ z.string()]),
		z.tuple([/** query */ z.string(), optionalParam(pagingValidator)])
	]),
	getMap: z.tuple([anyMapSlugValidator]),
	createMap: z.union([
		// Optional tuple parameters are not supported in zod yet, see https://github.com/colinhacks/zod/issues/149
		z.tuple([mapDataValidator.create]),
		z.tuple([mapDataValidator.create, optionalParam(z.object({ pick: z.array(allMapObjectsPickValidator).optional(), bbox: bboxWithZoomValidator.optional() }))])
	]),
	updateMap: z.tuple([anyMapSlugValidator, mapDataValidator.update]),
	deleteMap: z.tuple([anyMapSlugValidator]),
	getAllMapObjects: z.union([
		// Optional tuple parameters are not supported in zod yet, see https://github.com/colinhacks/zod/issues/149
		z.tuple([anyMapSlugValidator]),
		z.tuple([anyMapSlugValidator, optionalParam(z.object({ pick: z.array(allMapObjectsPickValidator).optional(), bbox: bboxWithExceptValidator.optional() }))])
	]),
	findOnMap: z.tuple([anyMapSlugValidator, /** query */ z.string()]),
	getMapToken: z.union([
		// Optional tuple parameters are not supported in zod yet, see https://github.com/colinhacks/zod/issues/149
		z.tuple([anyMapSlugValidator]),
		z.tuple([anyMapSlugValidator, mapPermissionsValidator.create])
	]),

	getHistory: z.union([
		// Optional tuple parameters are not supported in zod yet, see https://github.com/colinhacks/zod/issues/149
		z.tuple([anyMapSlugValidator]),
		z.tuple([anyMapSlugValidator, optionalParam(pagingValidator)])
	]),
	revertHistoryEntry: z.tuple([anyMapSlugValidator, idValidator]),

	getMapMarkers: z.union([
		// Optional tuple parameters are not supported in zod yet, see https://github.com/colinhacks/zod/issues/149
		z.tuple([anyMapSlugValidator]),
		z.tuple([anyMapSlugValidator, optionalParam(z.object({ bbox: bboxWithExceptValidator.optional(), typeId: idValidator.optional() }))])
	]),
	getMarker: z.tuple([anyMapSlugValidator, idValidator]),
	createMarker: z.tuple([anyMapSlugValidator, markerValidator.create]),
	updateMarker: z.tuple([anyMapSlugValidator, idValidator, markerValidator.update]),
	deleteMarker: z.tuple([anyMapSlugValidator, idValidator]),

	getMapLines: z.union([
		// Optional tuple parameters are not supported in zod yet, see https://github.com/colinhacks/zod/issues/149
		z.tuple([anyMapSlugValidator]),
		z.tuple([anyMapSlugValidator, optionalParam(z.object({ bbox: bboxWithZoomValidator.optional(), includeTrackPoints: z.boolean().optional(), typeId: idValidator.optional() }))])
	]),
	getLine: z.tuple([anyMapSlugValidator, idValidator]),
	getLinePoints: z.tuple([anyMapSlugValidator, idValidator, z.object({ bbox: bboxWithExceptValidator.optional() }).optional()]),
	createLine: z.tuple([anyMapSlugValidator, lineValidator.create]),
	updateLine: z.tuple([anyMapSlugValidator, idValidator, lineValidator.update]),
	deleteLine: z.tuple([anyMapSlugValidator, idValidator]),
	exportLine: z.tuple([anyMapSlugValidator, idValidator, z.object({ format: exportFormatValidator })]),
	getLineTemplate: z.tuple([anyMapSlugValidator, z.object({ typeId: idValidator })]),

	getMapTypes: z.tuple([anyMapSlugValidator]),
	getType: z.tuple([anyMapSlugValidator, idValidator]),
	createType: z.tuple([anyMapSlugValidator, typeValidator.create]),
	updateType: z.tuple([anyMapSlugValidator, idValidator, typeValidator.update]),
	deleteType: z.tuple([anyMapSlugValidator, idValidator]),

	getMapViews: z.tuple([anyMapSlugValidator]),
	getView: z.tuple([anyMapSlugValidator, idValidator]),
	createView: z.tuple([anyMapSlugValidator, viewValidator.create]),
	updateView: z.tuple([anyMapSlugValidator, idValidator, viewValidator.update]),
	deleteView: z.tuple([anyMapSlugValidator, idValidator]),

	find: z.tuple([/** query */ z.string()]),
	findUrl: z.tuple([/** url */ z.string()]),
	getRoute: z.tuple([routeRequestValidator]),

	geoip: z.tuple([])
}

type ApiV3Response = {
	findMaps: PagedResults<FindMapsResult>;

	getMap: MapData;
	//createMap: generic, manual declaration in ApiV3 type
	updateMap: MapData;
	deleteMap: void;
	//getAllMapObjects: generic, manual declaration in ApiV3 type
	findOnMap: FindOnMapResult[];
	getMapToken: { token: string };

	getHistory: PagedResults<HistoryEntry>;
	revertHistoryEntry: void;

	getMapMarkers: StreamedResults<Marker>;
	getMarker: Marker;
	createMarker: Marker;
	updateMarker: Marker;
	deleteMarker: void;

	// getMapLines: generic, manual declaration in ApiV3 type
	getLine: Line;
	getLinePoints: StreamedResults<TrackPoint>;
	createLine: Line;
	updateLine: Line;
	deleteLine: void;
	exportLine: { type: string; filename: string; data: ReadableStream<Uint8Array> };
	getLineTemplate: LineTemplate;

	getMapTypes: StreamedResults<Type>;
	getType: Type;
	createType: Type;
	updateType: Type;
	deleteType: void;

	getMapViews: StreamedResults<View>;
	getView: View;
	createView: View;
	updateView: View;
	deleteView: void;

	find: SearchResult[];
	findUrl: { data: ReadableStream<Uint8Array> };
	getRoute: RouteInfo;

	geoip: Bbox | undefined;
};

/** A list of all methods whos first parameter is a map slug. */
export type ApiV3MapMethods = (
	| "getMap" | "updateMap" | "deleteMap" | "getAllMapObjects" | "findOnMap" | "getHistory"
	| "revertHistoryEntry" | "getMapMarkers" | "getMarker" | "createMarker" | "updateMarker" | "deleteMarker"
	| "getMapLines" | "getLine" | "getLinePoints" | "getLineTemplate" | "createLine" | "updateLine" | "deleteLine"
	| "exportLine" | "getMapTypes" | "getType" | "createType" | "updateType" | "deleteType" | "getMapViews"
	| "getView" | "createView" | "updateView" | "deleteView"
);

export type ApiV3<Validated extends boolean = false> = {
	[K in keyof ApiV3Response]: (...args: Validated extends true ? z.infer<typeof apiV3RequestValidators[K]> : z.input<typeof apiV3RequestValidators[K]>) => Promise<ApiV3Response[K]>;
} & {
	createMap: <Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }) => Promise<AsyncIterable<AllAdminMapObjectsItem<Pick>>>;
	getAllMapObjects: <Pick extends AllMapObjectsPick>(mapSlug: MapSlug, options?: { pick?: Pick[]; bbox?: BboxWithExcept }) => Promise<AsyncIterable<AllMapObjectsItem<Pick>>>;
	getMapLines: <IncludeTrackPoints extends boolean = false>(mapSlug: MapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }) => Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>>;
};