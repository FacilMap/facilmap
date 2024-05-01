import * as z from "zod";
import type { MapData, Writable } from "./mapData";
import { bboxValidator, bboxWithZoomValidator, type Bbox, type BboxWithZoom, type ExportFormat, type ID, type MapSlug, type ReplaceProperties } from "./base";
import type { CRU } from "./cru";
import type { Line, TrackPoint } from "./line";
import type { SearchResult } from "./searchResult";
import type { Marker } from "./marker";
import type { RouteInfo, RouteRequest } from "./route";
import type { Type } from "./type";
import type { View } from "./view";
import type { HistoryEntry } from "./historyEntry";

export const pagingValidator = z.object({
	start: z.coerce.number().int().min(0).optional(),
	limit: z.coerce.number().int().min(1).optional()
});
export type Paging = z.infer<typeof pagingValidator>;

export type FindMapsResult = Pick<MapData, "id" | "name" | "description">;

export interface PagedResults<T> {
	results: T[];
	totalLength: number;
}

export type StreamedResults<T> = {
	results: AsyncIterable<T>;
};

export type FindOnMapMarker = Pick<Marker, "id" | "name" | "typeId" | "lat" | "lon" | "icon"> & { kind: "marker"; similarity: number };
export type FindOnMapLine = Pick<Line, "id" | "name" | "typeId" | "left" | "top" | "right" | "bottom"> & { kind: "line"; similarity: number };
export type FindOnMapResult = FindOnMapMarker | FindOnMapLine;

export interface TrackPoints {
	[idx: number]: TrackPoint;
	length: number;
}

export interface LineWithTrackPoints extends Line {
	trackPoints: TrackPoints;
}

export type LinePoints = {
	lineId: ID;
	trackPoints: TrackPoint[];
}

export type MapDataWithWritable = (
	| { writable: Writable.ADMIN } & MapData
	| { writable: Writable.WRITE } & Omit<MapData, "adminId">
	| { writable: Writable.READ } & Omit<MapData, "adminId" | "writeId">
);

export const allMapObjectsPickValidator = z.enum(["mapData", "types", "views", "markers", "lines", "linesWithTrackPoints", "linePoints"]);
export type AllMapObjectsPick = z.infer<typeof allMapObjectsPickValidator>;

export type AllMapObjectsTypes = {
	mapData: ["mapData", MapDataWithWritable];
	types: ["type", Type];
	views: ["view", View];
	markers: ["marker", Marker];
	lines: ["line", Line];
	linesWithTrackPoints: ["line", LineWithTrackPoints];
	linePoints: ["linePoints", LinePoints];
};

export type AllMapObjectsItem<Pick extends AllMapObjectsPick> = (
	AllMapObjectsTypes[Pick]
);

export type AllAdminMapObjectsItem<Pick extends AllMapObjectsPick> = (
	ReplaceProperties<AllMapObjectsTypes, {
		mapData: ["mapData", Extract<MapDataWithWritable, { writable: Writable.ADMIN }>]
	}>[Pick]
);

export const stringifiedBooleanValidator = z.enum(["0", "1", "false", "true"]).transform((v) => ["true", "1"].includes(v));

export const bboxWithExceptValidator = bboxWithZoomValidator.extend({
	except: bboxValidator.optional()
});
export type BboxWithExcept = z.infer<typeof bboxWithExceptValidator>;

export interface Api<Validated extends boolean = false> {
	findMaps: (query: string, data: Paging) => Promise<PagedResults<FindMapsResult>>;

	getMap: (mapSlug: MapSlug) => Promise<MapDataWithWritable>;
	createMap: <Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }) => Promise<StreamedResults<AllAdminMapObjectsItem<Pick>>>;
	updateMap: (mapSlug: MapSlug, data: MapData<Validated extends true ? CRU.UPDATE_VALIDATED : CRU.UPDATE>) => Promise<MapDataWithWritable>;
	deleteMap: (mapSlug: MapSlug) => Promise<void>;
	getAllMapObjects: <Pick extends AllMapObjectsPick>(mapSlug: MapSlug, options: { pick: Pick[]; bbox?: BboxWithExcept }) => Promise<StreamedResults<AllMapObjectsItem<Pick>>>;
	findOnMap: (mapSlug: MapSlug, query: string) => Promise<FindOnMapResult[]>;

	getHistory: (mapSlug: MapSlug, data: Paging) => Promise<HistoryEntry[]>;
	revertHistoryEntry: (mapSlug: MapSlug, historyEntryId: ID) => Promise<void>;

	getMapMarkers: (mapSlug: MapSlug, options?: { bbox?: BboxWithExcept }) => Promise<StreamedResults<Marker>>;
	getMarker: (mapSlug: MapSlug, markerId: ID) => Promise<Marker>;
	createMarker: (mapSlug: MapSlug, data: Marker<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>) => Promise<Marker>;
	updateMarker: (mapSlug: MapSlug, markerId: ID, data: Marker<Validated extends true ? CRU.UPDATE_VALIDATED : CRU.UPDATE>) => Promise<Marker>;
	deleteMarker: (mapSlug: MapSlug, markerId: ID) => Promise<void>;

	getMapLines: <IncludeTrackPoints extends boolean = false>(mapSlug: MapSlug, options?: { bbox?: BboxWithZoom, includeTrackPoints?: IncludeTrackPoints }) => Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>>;
	getLine: (mapSlug: MapSlug, lineId: ID) => Promise<Line>;
	getLinePoints: (mapSlug: MapSlug, lineId: ID, bbox?: BboxWithZoom & { except?: Bbox }) => Promise<StreamedResults<TrackPoint>>;
	createLine: (mapSlug: MapSlug, data: Line<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>) => Promise<Line>;
	updateLine: (mapSlug: MapSlug, lineId: ID, data: Line<Validated extends true ? CRU.UPDATE_VALIDATED : CRU.UPDATE>) => Promise<Line>;
	deleteLine: (mapSlug: MapSlug, lineId: ID) => Promise<void>;
	exportLine: (mapSlug: MapSlug, lineId: ID, options: { format: ExportFormat }) => Promise<{ data: ReadableStream<string> }>;

	getMapTypes: (mapSlug: MapSlug) => Promise<StreamedResults<Type>>;
	getType: (mapSlug: MapSlug, typeId: ID) => Promise<Type>;
	createType: (mapSlug: MapSlug, data: Type<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>) => Promise<Type>;
	updateType: (mapSlug: MapSlug, typeId: ID, data: Type<Validated extends true ? CRU.UPDATE_VALIDATED : CRU.UPDATE>) => Promise<Type>;
	deleteType: (mapSlug: MapSlug, typeId: ID) => Promise<void>;

	getMapViews: (mapSlug: MapSlug) => Promise<StreamedResults<View>>;
	getView: (mapSlug: MapSlug, viewId: ID) => Promise<View>;
	createView: (mapSlug: MapSlug, data: View<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>) => Promise<View>;
	updateView: (mapSlug: MapSlug, viewId: ID, data: View<Validated extends true ? CRU.UPDATE_VALIDATED : CRU.UPDATE>) => Promise<View>;
	deleteView: (mapSlug: MapSlug, viewId: ID) => Promise<void>;

	find: (query: string) => Promise<SearchResult[]>;
	findUrl: (url: string) => Promise<{ data: ReadableStream<string> }>;
	getRoute: (data: RouteRequest) => Promise<RouteInfo>;

	geoip: () => Promise<Bbox | undefined>;
}
