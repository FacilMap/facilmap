import { ID, ObjectWithId } from "./base";
import { Type } from "./type";
import { HistoryEntry } from "./historyEntry";
import { View } from "./view";
import { Line, TrackPoint } from "./line";
import { Marker } from "./marker";
import { PadData } from "./padData";
import { RequestData, RequestName } from "./socket";

export interface LinePointsEvent {
	id: ID;
	reset?: boolean;
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
