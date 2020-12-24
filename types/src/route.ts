import { Point, RouteMode } from "./base";
import { LineExtraInfo, TrackPoint } from "./line";

interface RouteBase {
	routePoints: Point[];
	mode: RouteMode;
}

export interface RouteCreate extends RouteBase {
}

export interface Route extends RouteBase {
	id: string;
	trackPoints: TrackPoint[],
	distance: number;
	time?: number;
	ascent?: number;
	descent?: number;
	extraInfo?: LineExtraInfo;
}
