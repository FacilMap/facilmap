import { ID, ObjectWithId } from "./base.js";
import { Type } from "./type.js";
import { HistoryEntry } from "./historyEntry.js";
import { View } from "./view.js";
import { Line, TrackPoint } from "./line.js";
import { Marker } from "./marker.js";
import { PadData } from "./padData.js";

export interface LinePointsEvent {
	id: ID;
	reset?: boolean;
	trackPoints: TrackPoint[];
}

export interface RoutePointsEvent {
	routeId: string;
	trackPoints: TrackPoint[];
}

export interface MapEvents<DataType = Record<string, string>> {
	padData: [PadData];
	deletePad: [];
	marker: [Marker<DataType>];
	deleteMarker: [ObjectWithId];
	line: [Line<DataType>];
	deleteLine: [ObjectWithId];
	linePoints: [LinePointsEvent];
	routePoints: [TrackPoint[]];
	routePointsWithId: [RoutePointsEvent];
	view: [View];
	deleteView: [ObjectWithId];
	type: [Type];
	deleteType: [ObjectWithId];
	history: [HistoryEntry];
}

export type EventName<Events extends Record<keyof Events, any[]>> = keyof Events & string;

export type EventHandler<Events extends Record<keyof Events, any[]>, E extends EventName<Events>> = (...args: Events[E]) => void;

export type MultipleEvents<Events extends Record<keyof Events, any[]>> = {
	[E in EventName<Events>]?: Array<Events[E][0]>;
};