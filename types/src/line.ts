import { Bbox, Colour, ID, Point, RouteMode, ZoomLevel } from "./base";
import { PadId } from "./padData";

export type ExtraInfo = Record<string, string[]>;

interface LineBase {
	id: ID;
	routePoints: Point[];
	mode: RouteMode;
	colour: Colour;
	width: number;
	name: string;
	typeId: ID;
	data: Record<string, string>;
	extraInfo?: ExtraInfo;
	padId: PadId;
}

export interface Line extends LineBase, Bbox {
	distance: number;
	ascent?: number;
	descent?: number;
	time?: number;
}

export interface TrackPoint extends Point {
	idx: number;
	zoom: ZoomLevel;
	ele?: number;
}

interface LineWithTrackPoints extends LineBase {
	trackPoints?: TrackPoint[];
}

export type LineCreate = Omit<LineWithTrackPoints, "id" | "padId">;
export type LineUpdate = Partial<LineCreate>;
