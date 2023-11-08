import { type Bbox, idValidator, pointValidator, routeModeValidator } from "./base.js";
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

const routeBaseValidator = z.object({
	routePoints: z.array(pointValidator),
	mode: routeModeValidator
});
type RouteBase = z.infer<typeof routeBaseValidator>;

export const routeCreateValidator = routeBaseValidator.extend({
	routeId: z.string().optional()
});
export type RouteCreate = z.infer<typeof routeCreateValidator>;

export const routeClearValidator = z.object({
	routeId: z.string().optional()
});
export type RouteClear = z.infer<typeof routeClearValidator>;

export const lineToRouteCreateValidator = z.object({
	/** The ID of the line. */
	id: idValidator,
	routeId: z.string().optional()
});
export type LineToRouteCreate = z.infer<typeof lineToRouteCreateValidator>;

export interface Route extends RouteBase, RouteInfo {
	routeId?: string;
}

export const routeRequestValidator = z.object({
	destinations: z.array(pointValidator),
	mode: routeModeValidator
});
export type RouteRequest = z.infer<typeof routeRequestValidator>;
