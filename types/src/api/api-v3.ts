import type { MapData } from "../mapData";
import { type Bbox, type BboxWithZoom, type ExportFormat, type ID, type MapSlug } from "../base";
import type { CRU } from "../cru";
import type { Line, TrackPoint } from "../line";
import type { SearchResult } from "../searchResult";
import type { Marker } from "../marker";
import type { RouteInfo, RouteRequest } from "../route";
import type { Type } from "../type";
import type { View } from "../view";
import type { HistoryEntry } from "../historyEntry";
import type { AllAdminMapObjectsItem, AllMapObjectsItem, AllMapObjectsPick, BboxWithExcept, FindMapsResult, FindOnMapResult, LineWithTrackPoints, MapDataWithWritable, PagedResults, Paging, StreamedResults } from "./api-common";

export type ApiV3<Validated extends boolean = false> = {
	findMaps: (query: string, data: Paging) => Promise<PagedResults<FindMapsResult>>;

	getMap: (mapSlug: MapSlug) => Promise<MapDataWithWritable>;
	createMap: <Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }) => Promise<StreamedResults<AllAdminMapObjectsItem<Pick>>>;
	updateMap: (mapSlug: MapSlug, data: MapData<Validated extends true ? CRU.UPDATE_VALIDATED : CRU.UPDATE>) => Promise<MapDataWithWritable>;
	deleteMap: (mapSlug: MapSlug) => Promise<void>;
	getAllMapObjects: <Pick extends AllMapObjectsPick>(mapSlug: MapSlug, options: { pick: Pick[]; bbox?: BboxWithExcept }) => Promise<StreamedResults<AllMapObjectsItem<Pick>>>;
	findOnMap: (mapSlug: MapSlug, query: string) => Promise<FindOnMapResult[]>;

	getHistory: (mapSlug: MapSlug, data: Paging) => Promise<HistoryEntry[]>;
	revertHistoryEntry: (mapSlug: MapSlug, historyEntryId: ID) => Promise<void>;

	getMapMarkers: (mapSlug: MapSlug, options?: { bbox?: BboxWithExcept; typeId?: ID }) => Promise<StreamedResults<Marker>>;
	getMarker: (mapSlug: MapSlug, markerId: ID) => Promise<Marker>;
	createMarker: (mapSlug: MapSlug, data: Marker<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>) => Promise<Marker>;
	updateMarker: (mapSlug: MapSlug, markerId: ID, data: Marker<Validated extends true ? CRU.UPDATE_VALIDATED : CRU.UPDATE>) => Promise<Marker>;
	deleteMarker: (mapSlug: MapSlug, markerId: ID) => Promise<void>;

	getMapLines: <IncludeTrackPoints extends boolean = false>(mapSlug: MapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }) => Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>>;
	getLine: (mapSlug: MapSlug, lineId: ID) => Promise<Line>;
	getLinePoints: (mapSlug: MapSlug, lineId: ID, options?: { bbox?: BboxWithZoom & { except?: Bbox } }) => Promise<StreamedResults<TrackPoint>>;
	createLine: (mapSlug: MapSlug, data: Line<Validated extends true ? CRU.CREATE_VALIDATED : CRU.CREATE>) => Promise<Line>;
	updateLine: (mapSlug: MapSlug, lineId: ID, data: Line<Validated extends true ? CRU.UPDATE_VALIDATED : CRU.UPDATE>) => Promise<Line>;
	deleteLine: (mapSlug: MapSlug, lineId: ID) => Promise<void>;
	exportLine: (mapSlug: MapSlug, lineId: ID, options: { format: ExportFormat }) => Promise<{ type: string; filename: string; data: ReadableStream<string> }>;

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
};