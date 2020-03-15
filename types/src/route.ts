import { Point, RouteMode } from "./base";
import { TrackPoint } from "./line";

interface RouteBase {
	routePoints: Point[];
	mode: RouteMode;
}

export interface RouteCreate extends RouteBase {
}

export interface Route extends RouteBase {
	trackPoints: TrackPoint[],
	distance: number;
	time?: number;
	ascent?: number;
	descent?: number;
}
