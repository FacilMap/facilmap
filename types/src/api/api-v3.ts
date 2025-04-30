import { mapDataValidator, mapPermissionsValidator, type MapData } from "../mapData.js";
import { bboxWithZoomValidator, idValidator, mapSlugOrJwtValidator, type Bbox, type BboxWithZoom, type ID, type Stripped } from "../base.js";
import type { CRU } from "../cru.js";
import { lineValidator, type Line, type LineTemplate, type TrackPoint } from "../line.js";
import type { SearchResult } from "../searchResult.js";
import { markerValidator, type Marker } from "../marker.js";
import { routeRequestValidator, type RouteInfo } from "../route.js";
import { typeValidator, type Type } from "../type.js";
import { viewValidator, type View } from "../view.js";
import type { HistoryEntry } from "../historyEntry.js";
import { allMapObjectsPickValidator, bboxWithExceptValidator, optionalParam, pagingValidator, type AllMapObjectsItem, type AllMapObjectsPick, type BboxWithExcept, type ExportResult, type FindMapsResult, type FindOnMapResult, type LineWithTrackPoints, type PagedResults, type StreamedResults } from "./api-common.js";
import * as z from "zod";
import { tupleWithOptional } from "zod-tuple-with-optional";

export const anyMapSlugValidator = mapSlugOrJwtValidator.or(z.object({
	mapSlug: mapSlugOrJwtValidator,
	password: z.string().optional(),
	identity: z.string().optional()
}));
export type AnyMapSlug = z.infer<typeof anyMapSlugValidator>;


export const apiV3RequestValidators = {
	findMaps: tupleWithOptional([/** query */ z.string(), optionalParam(pagingValidator)]),
	getMap: z.tuple([anyMapSlugValidator]),
	createMap: tupleWithOptional([mapDataValidator.create, optionalParam(z.object({
		pick: z.array(allMapObjectsPickValidator).optional(),
		bbox: bboxWithZoomValidator.optional()
	}))]),
	updateMap: z.tuple([anyMapSlugValidator, mapDataValidator.update]),
	deleteMap: z.tuple([anyMapSlugValidator]),
	getAllMapObjects: tupleWithOptional([anyMapSlugValidator, optionalParam(z.object({
		pick: z.array(allMapObjectsPickValidator).optional(),
		bbox: bboxWithExceptValidator.optional()
	}))]),
	findOnMap: z.tuple([anyMapSlugValidator, /** query */ z.string()]),
	getMapToken: z.tuple([anyMapSlugValidator, z.object({
		permissions: mapPermissionsValidator,
		noPassword: z.boolean().default(false)
	})]),

	exportMapAsGpx: tupleWithOptional([anyMapSlugValidator, optionalParam(z.object({
		rte: z.boolean().optional(),
		filter: z.string().optional()
	}))]),
	exportMapAsGpxZip: tupleWithOptional([anyMapSlugValidator, optionalParam(z.object({
		rte: z.boolean().optional(),
		filter: z.string().optional()
	}))]),
	exportMapAsGeoJson: tupleWithOptional([anyMapSlugValidator, optionalParam(z.object({
		filter: z.string().optional()
	}))]),
	exportMapAsTable: z.tuple([anyMapSlugValidator, z.object({
		typeId: idValidator,
		filter: z.string().optional(),
		hide: z.array(z.string()).optional()
	})]),
	exportMapAsCsv: z.tuple([anyMapSlugValidator, z.object({
		typeId: idValidator,
		filter: z.string().optional(),
		hide: z.array(z.string()).optional()
	})]),

	getHistory: tupleWithOptional([anyMapSlugValidator, optionalParam(pagingValidator)]),
	revertHistoryEntry: z.tuple([anyMapSlugValidator, idValidator]),

	getMapMarkers: tupleWithOptional([anyMapSlugValidator, optionalParam(z.object({
		bbox: bboxWithExceptValidator.optional(),
		typeId: idValidator.optional()
	}))]),
	getMarker: z.tuple([anyMapSlugValidator, idValidator]),
	createMarker: z.tuple([anyMapSlugValidator, markerValidator.create]),
	updateMarker: z.tuple([anyMapSlugValidator, idValidator, markerValidator.update]),
	deleteMarker: z.tuple([anyMapSlugValidator, idValidator]),

	getMapLines: tupleWithOptional([anyMapSlugValidator, optionalParam(z.object({
		bbox: bboxWithZoomValidator.optional(),
		includeTrackPoints: z.boolean().optional(),
		typeId: idValidator.optional()
	}))]),
	getLine: z.tuple([anyMapSlugValidator, idValidator]),
	getLinePoints: z.tuple([anyMapSlugValidator, idValidator, optionalParam(z.object({
		bbox: bboxWithExceptValidator.optional()
	}))]),
	createLine: z.tuple([anyMapSlugValidator, lineValidator.create]),
	updateLine: z.tuple([anyMapSlugValidator, idValidator, lineValidator.update]),
	deleteLine: z.tuple([anyMapSlugValidator, idValidator]),
	exportLineAsGpx: tupleWithOptional([anyMapSlugValidator, idValidator, optionalParam(z.object({
		rte: z.boolean().optional()
	}))]),
	exportLineAsGeoJson: z.tuple([anyMapSlugValidator, idValidator]),
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

	getMap: Stripped<MapData>;
	//createMap: generic, manual declaration in ApiV3 type
	updateMap: Stripped<MapData>;
	deleteMap: void;
	//getAllMapObjects: generic, manual declaration in ApiV3 type
	findOnMap: Array<Stripped<FindOnMapResult>>;
	getMapToken: { token: string };

	exportMapAsGpx: ExportResult;
	exportMapAsGpxZip: ExportResult;
	exportMapAsGeoJson: ExportResult;
	exportMapAsTable: ExportResult;
	exportMapAsCsv: ExportResult;

	getHistory: PagedResults<Stripped<HistoryEntry>>;
	revertHistoryEntry: void;

	getMapMarkers: StreamedResults<Stripped<Marker>>;
	getMarker: Stripped<Marker>;
	createMarker: Stripped<Marker>;
	updateMarker: Stripped<Marker>;
	deleteMarker: void;

	// getMapLines: generic, manual declaration in ApiV3 type
	getLine: Stripped<Line>;
	getLinePoints: StreamedResults<TrackPoint>;
	createLine: Stripped<Line>;
	updateLine: Stripped<Line>;
	deleteLine: void;
	exportLineAsGpx: ExportResult;
	exportLineAsGeoJson: ExportResult;

	getLineTemplate: LineTemplate;

	getMapTypes: StreamedResults<Stripped<Type>>;
	getType: Stripped<Type>;
	createType: Stripped<Type>;
	updateType: Stripped<Type>;
	deleteType: void;

	getMapViews: StreamedResults<Stripped<View>>;
	getView: Stripped<View>;
	createView: Stripped<View>;
	updateView: Stripped<View>;
	deleteView: void;

	find: SearchResult[];
	findUrl: { data: ReadableStream<Uint8Array> };
	getRoute: RouteInfo;

	geoip: Bbox | undefined;
};

export type ApiV3<Validated extends boolean = false> = {
	[K in keyof ApiV3Response]: (...args: Validated extends true ? z.infer<typeof apiV3RequestValidators[K]> : z.input<typeof apiV3RequestValidators[K]>) => Promise<ApiV3Response[K]>;
} & {
	createMap: <Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }) => Promise<AsyncIterable<AllMapObjectsItem<Pick>>>;
	getAllMapObjects: <Pick extends AllMapObjectsPick>(mapSlug: AnyMapSlug, options?: { pick?: Pick[]; bbox?: BboxWithExcept }) => Promise<AsyncIterable<AllMapObjectsItem<Pick>>>;
	getMapLines: <IncludeTrackPoints extends boolean = false>(mapSlug: AnyMapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }) => Promise<StreamedResults<IncludeTrackPoints extends true ? Stripped<LineWithTrackPoints> : Stripped<Line>>>;
};