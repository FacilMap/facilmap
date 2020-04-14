import { AllOptionalExceptId, Bbox, Colour, ID, OmitId, Point, RouteMode, ZoomLevel } from "./base";

interface LineBase {
	id: ID;
	routePoints: Point[];
	mode: RouteMode;
	colour: Colour;
	width: number;
	name: string;
	typeId: ID;
	data: Record<string, string>;
}

export interface Line extends LineBase, Bbox {
	distance: number;
	ascent: number;
	descent: number;
	time: number;
}

export interface TrackPoint extends Point {
	idx: number;
	zoom: ZoomLevel;
	ele?: number;
}

interface TrackLineCreate extends LineBase {
	mode: "track";
	trackPoints: TrackPoint[];
}

export type LineCreate = OmitId<LineBase | TrackLineCreate>;
export type LineUpdate = AllOptionalExceptId<LineBase | TrackLineCreate>;
