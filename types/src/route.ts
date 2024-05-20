import { type Bbox, idValidator, pointValidator, routeModeValidator, mapSlugValidator } from "./base.js";
import type { ExtraInfo, TrackPoint } from "./line.js";
import * as z from "zod";

export interface RouteInfo extends Bbox {
	trackPoints: TrackPoint[];
	distance: number;
	time?: number;
	ascent?: number;
	descent?: number;
	extraInfo?: ExtraInfo;
}

export const routeParametersValidator = z.object({
	routePoints: z.array(pointValidator),
	mode: routeModeValidator
});
export type RouteParameters = z.infer<typeof routeParametersValidator>;

export const lineToRouteValidator = z.object({
	mapSlug: mapSlugValidator,
	lineId: idValidator
});

export interface Route extends RouteParameters, RouteInfo {
	routeId: string;
}

export const routeRequestValidator = z.object({
	destinations: z.array(pointValidator),
	mode: routeModeValidator
});
export type RouteRequest = z.infer<typeof routeRequestValidator>;
