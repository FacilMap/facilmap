import { bboxValidator, colourValidator, idValidator, mapIdValidator, pointValidator, routeModeValidator, strokeValidator, zoomLevelValidator, type Bbox } from "./base.js";
import { CRU, type CRUType, cruValidator, optionalCreate, onlyRead, optionalUpdate, mapValues, exceptRead } from "./cru";
import * as z from "zod";

export const extraInfoValidator = z.record(z.array(z.tuple([z.number(), z.number(), z.number()])));
export type ExtraInfo = z.infer<typeof extraInfoValidator>;

export const trackPointValidator = cruValidator({
	...pointValidator.shape,
	ele: optionalCreate(z.number().or(z.null()), null),
	idx: onlyRead(z.number()),
	zoom: onlyRead(zoomLevelValidator)
});
export type TrackPoint<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof trackPointValidator>;

export const lineValidator = cruValidator({
	id: onlyRead(idValidator),
	routePoints: optionalUpdate(z.array(pointValidator).min(2)),
	typeId: optionalUpdate(idValidator),
	name: optionalCreate(z.string().trim().max(100), ""),
	mode: optionalCreate(routeModeValidator), // defaults to type.defaultMode
	colour: optionalCreate(colourValidator), // defaults to type.defaultColour
	width: optionalCreate(z.number()), // defaults to type.defaultWidth
	stroke: optionalCreate(strokeValidator), // defaults to type.defaultStroke
	data: optionalCreate(z.record(z.string())),
	extraInfo: optionalCreate(extraInfoValidator.or(z.null()), null),

	...mapValues(bboxValidator.shape, onlyRead),
	distance: onlyRead(z.number()),
	ascent: onlyRead(z.number().or(z.null())),
	descent: onlyRead(z.number().or(z.null())),
	time: onlyRead(z.number().or(z.null())),
	mapId: onlyRead(mapIdValidator),

	trackPoints: exceptRead(z.array(trackPointValidator.create).optional())
});
export type Line<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof lineValidator>;

export type LineTemplate = Omit<Line, "id" | "routePoints" | "extraInfo" | keyof Bbox | "distance" | "ascent" | "descent" | "time" | "mapId">;