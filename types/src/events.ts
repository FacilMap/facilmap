import type { ID, ObjectWithId } from "./base.js";
import type { Type } from "./type.js";
import type { HistoryEntry } from "./historyEntry.js";
import type { View } from "./view.js";
import type { Line, TrackPoint } from "./line.js";
import type { Marker } from "./marker.js";
import type { PadData } from "./padData";

export interface LinePointsEvent {
	id: ID;
	reset?: boolean;
	trackPoints: TrackPoint[];
}

export interface RoutePointsEvent {
	routeId: string;
	trackPoints: TrackPoint[];
}

export interface MapEvents {
	padData: [PadData];
	deletePad: [];
	marker: [Marker];
	deleteMarker: [ObjectWithId];
	line: [Line];
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