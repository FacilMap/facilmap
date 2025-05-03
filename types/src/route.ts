import { anyMapSlugValidator } from "./api/api-common.js";
import { type Bbox, idValidator, pointValidator, routeModeValidator } from "./base.js";
import type { ExtraInfo } from "./line.js";
import * as z from "zod";

export interface RouteInfo extends Bbox {
	distance: number;
	time: number | null;
	ascent: number | null;
	descent: number | null;
	extraInfo: ExtraInfo | null;
}

export const routeParametersValidator = z.object({
	routePoints: z.array(pointValidator),
	mode: routeModeValidator
});
export type RouteParameters = z.infer<typeof routeParametersValidator>;

export const lineToRouteRequestValidator = z.object({
	mapSlug: anyMapSlugValidator,
	lineId: idValidator
});
export type LineToRouteRequest = z.infer<typeof lineToRouteRequestValidator>;

export interface Route extends RouteParameters, RouteInfo {
}

export const routeRequestValidator = z.object({
	routePoints: z.array(pointValidator),
	mode: routeModeValidator
});
export type RouteRequest = z.infer<typeof routeRequestValidator>;
