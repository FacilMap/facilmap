import { Bbox, ID, Point, RouteMode } from "./base";
import { ExtraInfo, TrackPoint } from "./line";

export interface RouteInfo extends Bbox {
	trackPoints: TrackPoint[];
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
	routeId?: string;
}

export type RouteClear = {
	routeId?: string;
};

export interface LineToRouteCreate {
	/** The ID of the line. */
	id: ID;
	routeId?: string;
}

export interface Route extends RouteBase, RouteInfo {
	routeId?: string;
}

export interface RouteRequest {
	destinations: Point[];
	mode: RouteMode;
}