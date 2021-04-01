import { Bbox, Colour, ID, Point, RouteMode, ZoomLevel } from "./base";
import { PadId } from "./padData";

export type ExtraInfo = Record<string, Array<[number, number, number]>>;

interface LineBase<DataType = Record<string, string>> {
	id: ID;
	routePoints: Point[];
	mode: RouteMode;
	colour: Colour;
	width: number;
	name: string;
	typeId: ID;
	data: DataType;
	extraInfo?: ExtraInfo;
	padId: PadId;
}

export interface Line<DataType = Record<string, string>> extends LineBase<DataType>, Bbox {
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

export type LineCreate<DataType = Record<string, string>> = Partial<Omit<LineBase<DataType>, "id" | "padId">> & Pick<LineBase<DataType>, "routePoints" | "typeId"> & {
	trackPoints?: TrackPointCreate[];
};
export type LineUpdate<DataType = Record<string, string>> = Partial<LineCreate<DataType>>;
