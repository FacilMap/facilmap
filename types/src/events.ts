import { ID, ObjectWithId } from "./base";
import { Type } from "./type";
import { HistoryEntry } from "./historyEntry";
import { View } from "./view";
import { Line, TrackPoint } from "./line";
import { Marker } from "./marker";
import { PadData } from "./padData";

export interface LinePointsEvent {
	id: ID;
	reset: boolean;
	trackPoints: TrackPoint[];
}

export interface EventMap {
	padData: PadData;
	deletePad: void;
	marker: Marker;
	deleteMarker: ObjectWithId;
	line: Line;
	deleteLine: ObjectWithId;
	linePoints: LinePointsEvent;
	routePoints: TrackPoint[];
	view: View;
	deleteView: ObjectWithId;
	type: Type;
	deleteType: ObjectWithId;
	history: HistoryEntry;
}

export type EventName = keyof EventMap;
export type EventData<E extends EventName> = EventMap[E];
export type EventHandler<E extends EventName> = EventData<E> extends void ? (data?: undefined) => void : (data: EventData<E>) => void;

export type EventDataParams<E extends EventName> = Array<EventData<E>> & (EventData<E> extends void ? {
	0?: undefined
} : {
	0: EventData<E>
});

export type MultipleEvents = {
	[E in EventName]?: Array<EventData<E>> | undefined
};
