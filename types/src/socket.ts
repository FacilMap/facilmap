import { Bbox, BboxWithZoom, ExportFormat, ID, ObjectWithId } from "./base";
import { PadData, PadDataCreate, PadDataUpdate } from "./padData";
import { Marker, MarkerCreate, MarkerUpdate } from "./marker";
import { Line, LineCreate, LineUpdate } from "./line";
import { Route, RouteCreate, RouteInfo, RouteRequest } from "./route";
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
	format: ExportFormat
}

export interface FindQuery {
	query: string;
	loadUrls?: boolean;
	elevation?: boolean;
}

export interface FindOnMapQuery {
	query: string;
}

export type FindOnMapMarker = Pick<Marker, "id" | "name" | "typeId" | "lat" | "lon"> & { kind: "marker"; similarity: number };
export type FindOnMapLine = Pick<Line, "id" | "name" | "typeId" | "left" | "top" | "right" | "bottom"> & { kind: "line"; similarity: number };
export type FindOnMapResult = FindOnMapMarker | FindOnMapLine;

export interface RequestDataMap {
	updateBbox: BboxWithZoom;
	createPad: PadDataCreate;
	editPad: PadDataUpdate;
	deletePad: void;
	listenToHistory: void;
	stopListeningToHistory: void;
	revertHistoryEntry: ObjectWithId;
	getMarker: ObjectWithId;
	addMarker: MarkerCreate;
	editMarker: ObjectWithId & MarkerUpdate;
	deleteMarker: ObjectWithId;
	getLineTemplate: LineTemplateRequest;
	addLine: LineCreate;
	editLine: ObjectWithId & LineUpdate;
	deleteLine: ObjectWithId;
	exportLine: LineExportRequest;
	find: FindQuery;
	findOnMap: FindOnMapQuery;
	getRoute: RouteRequest;
	setRoute: RouteCreate;
	clearRoute: void;
	lineToRoute: ObjectWithId;
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

export interface ResponseDataMap {
	updateBbox: MultipleEvents<MapEvents>;
	createPad: MultipleEvents<MapEvents>;
	editPad: PadData;
	deletePad: void;
	listenToHistory: MultipleEvents<MapEvents>;
	stopListeningToHistory: void;
	revertHistoryEntry: MultipleEvents<MapEvents>;
	getMarker: Marker;
	addMarker: Marker;
	editMarker: Marker;
	deleteMarker: Marker;
	getLineTemplate: Line;
	addLine: Line;
	editLine: Line;
	deleteLine: Line;
	exportLine: string;
	find: string | SearchResult[];
	findOnMap: Array<FindOnMapResult>;
	getRoute: RouteInfo;
	setRoute: Route | undefined;
	clearRoute: void;
	lineToRoute: Route;
	exportRoute: string;
	addType: Type;
	editType: Type;
	deleteType: Type;
	addView: View;
	editView: View;
	deleteView: View;
	geoip: Bbox | null;
	setPadId: MultipleEvents<MapEvents>;
}

export type RequestName = keyof RequestDataMap;
export type RequestData<E extends RequestName> = RequestDataMap[E];
export type ResponseData<E extends RequestName> = ResponseDataMap[E];
