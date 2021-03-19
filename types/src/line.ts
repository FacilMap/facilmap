import { Bbox, Colour, ID, Point, RouteMode, ZoomLevel } from "./base";
import { PadId } from "./padData";

export type ExtraInfo = Record<string, Array<[number, number, number]>>;

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

export type TrackPointCreate = Omit<TrackPoint, "idx" | "zoom">;

export type LineCreate = Partial<Omit<LineBase, "id" | "padId">> & Pick<LineBase, "routePoints" | "typeId"> & {
	trackPoints?: TrackPointCreate[];
};
export type LineUpdate = Partial<LineCreate>;
