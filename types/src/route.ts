import { Point, RouteMode } from "./base";
import { ExtraInfo, TrackPoint } from "./line";

export interface RouteInfo {
	trackPoints: TrackPoint[],
	distance: number;
	time?: number;
	ascent?: number;
	descent?: number;
	extraInfo?: ExtraInfo;
}

interface RouteBase {
	routePoints: Point[];
	mode: RouteMode;
}

export interface RouteCreate extends RouteBase {
}

export interface Route extends RouteBase, RouteInfo {
}

export interface RouteRequest {
	destinations: Point[];
	mode: RouteMode;
}
