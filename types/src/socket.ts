import { Bbox, BboxWithZoom, ExportFormat, ID, ObjectWithId } from "./base";
import { PadData, PadDataCreate, PadDataUpdate } from "./padData";
import { Marker, MarkerCreate, MarkerUpdate } from "./marker";
import { Line, LineCreate, LineUpdate } from "./line";
import { LineToRouteCreate, Route, RouteClear, RouteCreate, RouteInfo, RouteRequest } from "./route";
import { Type, TypeCreate, TypeUpdate } from "./type";
import { View, ViewCreate, ViewUpdate } from "./view";
import { MapEvents, MultipleEvents } from "./events";
import { SearchResult } from "./searchResult";

export interface LineTemplateRequest {
	typeId: ID
}

export interface LineExportRequest {
	id: ID;
	format: ExportFormat
}

export interface RouteExportRequest {
	format: ExportFormat;
	routeId?: string;
}

export interface FindQuery {
	query: string;
	loadUrls?: boolean;
	elevation?: boolean;
}

export interface FindOnMapQuery {
	query: string;
}

export type FindOnMapMarker = Pick<Marker, "id" | "name" | "typeId" | "lat" | "lon" | "symbol"> & { kind: "marker"; similarity: number };
export type FindOnMapLine = Pick<Line, "id" | "name" | "typeId" | "left" | "top" | "right" | "bottom"> & { kind: "line"; similarity: number };
export type FindOnMapResult = FindOnMapMarker | FindOnMapLine;

export interface RequestDataMap<DataType = Record<string, string>> {
	updateBbox: BboxWithZoom;
	createPad: PadDataCreate;
	editPad: PadDataUpdate;
	deletePad: void;
	listenToHistory: void;
	stopListeningToHistory: void;
	revertHistoryEntry: ObjectWithId;
	getMarker: ObjectWithId;
	addMarker: MarkerCreate<DataType>;
	editMarker: ObjectWithId & MarkerUpdate<DataType>;
	deleteMarker: ObjectWithId;
	getLineTemplate: LineTemplateRequest;
	addLine: LineCreate<DataType>;
	editLine: ObjectWithId & LineUpdate<DataType>;
	deleteLine: ObjectWithId;
	exportLine: LineExportRequest;
	find: FindQuery;
	findOnMap: FindOnMapQuery;
	getRoute: RouteRequest;
	setRoute: RouteCreate;
	clearRoute: RouteClear | undefined;
	lineToRoute: LineToRouteCreate;
	exportRoute: RouteExportRequest;
	addType: TypeCreate;
	editType: ObjectWithId & TypeUpdate;
	deleteType: ObjectWithId;
	addView: ViewCreate;
	editView: ObjectWithId & ViewUpdate;
	deleteView: ObjectWithId;
	geoip: void;
	setPadId: string;
}

export interface ResponseDataMap<DataType = Record<string, string>> {
	updateBbox: MultipleEvents<MapEvents<DataType>>;
	createPad: MultipleEvents<MapEvents<DataType>>;
	editPad: PadData;
	deletePad: void;
	listenToHistory: MultipleEvents<MapEvents<DataType>>;
	stopListeningToHistory: void;
	revertHistoryEntry: MultipleEvents<MapEvents<DataType>>;
	getMarker: Marker<DataType>;
	addMarker: Marker<DataType>;
	editMarker: Marker<DataType>;
	deleteMarker: Marker<DataType>;
	getLineTemplate: Line<DataType>;
	addLine: Line<DataType>;
	editLine: Line<DataType>;
	deleteLine: Line<DataType>;
	exportLine: string;
	find: string | SearchResult[];
	findOnMap: Array<FindOnMapResult>;
	getRoute: RouteInfo;
	setRoute: Route | undefined;
	clearRoute: void;
	lineToRoute: Route | undefined;
	exportRoute: string;
	addType: Type;
	editType: Type;
	deleteType: Type;
	addView: View;
	editView: View;
	deleteView: View;
	geoip: Bbox | null;
	setPadId: MultipleEvents<MapEvents<DataType>>;
}

export type RequestName = keyof RequestDataMap;
export type RequestData<E extends RequestName, DataType = Record<string, string>> = RequestDataMap<DataType>[E];
export type ResponseData<E extends RequestName, DataType = Record<string, string>> = ResponseDataMap<DataType>[E];
