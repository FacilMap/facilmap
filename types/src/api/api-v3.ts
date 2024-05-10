import { mapDataValidator, type MapData } from "../mapData";
import { bboxWithZoomValidator, exportFormatValidator, idValidator, mapSlugValidator, type Bbox, type BboxWithZoom, type ID, type MapSlug } from "../base";
import type { CRU } from "../cru";
import { lineValidator, type Line, type TrackPoint } from "../line";
import type { SearchResult } from "../searchResult";
import { markerValidator, type Marker } from "../marker";
import { routeRequestValidator, type RouteInfo } from "../route";
import { typeValidator, type Type } from "../type";
import { viewValidator, type View } from "../view";
import type { HistoryEntry } from "../historyEntry";
import { allMapObjectsPickValidator, bboxWithExceptValidator, pagingValidator, type AllAdminMapObjectsItem, type AllMapObjectsItem, type AllMapObjectsPick, type BboxWithExcept, type FindMapsResult, type FindOnMapResult, type LineWithTrackPoints, type MapDataWithWritable, type PagedResults, type StreamedResults } from "./api-common";
import * as z from "zod";

export const apiV3RequestValidators = {
	findMaps: z.tuple([/** query */ z.string(), pagingValidator.default(() => ({}))]),
	getMap: z.tuple([z.string()]),
	createMap: z.tuple([mapDataValidator.create, z.object({ pick: z.array(allMapObjectsPickValidator).optional(), bbox: bboxWithZoomValidator.optional() }).optional()]),
	updateMap: z.tuple([mapSlugValidator, mapDataValidator.update]),
	deleteMap: z.tuple([mapSlugValidator]),
	getAllMapObjects: z.tuple([mapSlugValidator, z.object({ pick: z.array(allMapObjectsPickValidator), bbox: bboxWithExceptValidator.optional() })]),
	findOnMap: z.tuple([mapSlugValidator, /** query */ z.string()]),

	getHistory: z.tuple([mapSlugValidator, pagingValidator.default(() => ({}))]),
	revertHistoryEntry: z.tuple([mapSlugValidator, idValidator]),

	getMapMarkers: z.tuple([mapSlugValidator, z.object({ bbox: bboxWithExceptValidator.optional(), typeId: idValidator.optional() }).optional()]),
	getMarker: z.tuple([mapSlugValidator, idValidator]),
	createMarker: z.tuple([mapSlugValidator, markerValidator.create]),
	updateMarker: z.tuple([mapSlugValidator, idValidator, markerValidator.update]),
	deleteMarker: z.tuple([mapSlugValidator, idValidator]),

	getMapLines: z.tuple([mapSlugValidator, z.object({ bbox: bboxWithZoomValidator.optional(), includeTrackPoints: z.boolean().optional(), typeId: idValidator.optional() }).optional()]),
	getLine: z.tuple([mapSlugValidator, idValidator]),
	getLinePoints: z.tuple([mapSlugValidator, idValidator, z.object({ bbox: bboxWithExceptValidator.optional() }).optional()]),
	createLine: z.tuple([mapSlugValidator, lineValidator.create]),
	updateLine: z.tuple([mapSlugValidator, idValidator, lineValidator.update]),
	deleteLine: z.tuple([mapSlugValidator, idValidator]),
	exportLine: z.tuple([mapSlugValidator, idValidator, z.object({ format: exportFormatValidator })]),

	getMapTypes: z.tuple([mapSlugValidator]),
	getType: z.tuple([mapSlugValidator, idValidator]),
	createType: z.tuple([mapSlugValidator, typeValidator.create]),
	updateType: z.tuple([mapSlugValidator, idValidator, typeValidator.update]),
	deleteType: z.tuple([mapSlugValidator, idValidator]),

	getMapViews: z.tuple([mapSlugValidator]),
	getView: z.tuple([mapSlugValidator, idValidator]),
	createView: z.tuple([mapSlugValidator, viewValidator.create]),
	updateView: z.tuple([mapSlugValidator, idValidator, viewValidator.update]),
	deleteView: z.tuple([mapSlugValidator, idValidator]),

	find: z.tuple([/** query */ z.string()]),
	findUrl: z.tuple([/** url */ z.string()]),
	getRoute: z.tuple([routeRequestValidator]),

	geoip: z.tuple([])
}

type ApiV3Response = {
	findMaps: PagedResults<FindMapsResult>;

	getMap: MapDataWithWritable;
	//createMap: generic
	updateMap: MapDataWithWritable;
	deleteMap: void;
	//getAllMapObjects: generic
	findOnMap: FindOnMapResult[];

	getHistory: HistoryEntry[];
	revertHistoryEntry: void;

	getMapMarkers: StreamedResults<Marker>;
	getMarker: Marker;
	createMarker: Marker;
	updateMarker: Marker;
	deleteMarker: void;

	// getMapLines: generic
	getLine: Line;
	getLinePoints: StreamedResults<TrackPoint>;
	createLine: Line;
	updateLine: Line;
	deleteLine: void;
	exportLine: { type: string; filename: string; data: ReadableStream<string> };

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
	findUrl: { data: ReadableStream<string> };
	getRoute: RouteInfo;

	geoip: Bbox | undefined;
};

export type ApiV3<Validated extends boolean = false> = {
	[K in keyof ApiV3Response]: (...args: Validated extends true ? z.infer<typeof apiV3RequestValidators[K]> : z.input<typeof apiV3RequestValidators[K]>) => Promise<ApiV3Response[K]>;
} & {
	createMap: <Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }) => Promise<StreamedResults<AllAdminMapObjectsItem<Pick>>>;
	getAllMapObjects: <Pick extends AllMapObjectsPick>(mapSlug: MapSlug, options: { pick: Pick[]; bbox?: BboxWithExcept }) => Promise<StreamedResults<AllMapObjectsItem<Pick>>>;
	getMapLines: <IncludeTrackPoints extends boolean = false>(mapSlug: MapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }) => Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>>;
};