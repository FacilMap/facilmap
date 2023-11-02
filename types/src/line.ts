import { bboxValidator, colourValidator, idValidator, padIdValidator, pointValidator, routeModeValidator, zoomLevelValidator } from "./base.js";
import { CRU, CRUType, cruValidator } from "./cru";
import * as z from "zod";

export const extraInfoValidator = z.record(z.array(z.tuple([z.number(), z.number(), z.number()])));
export type ExtraInfo = z.infer<typeof extraInfoValidator>;

export const trackPointValidator = cruValidator({
	all: {
		...pointValidator.shape,
		ele: z.number().optional()
	},
	onlyRead: {
		idx: z.number(),
		zoom: zoomLevelValidator
	}
});
export type TrackPoint<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof trackPointValidator>;

export const lineValidator = cruValidator({
	allPartialCreate: {
		mode: routeModeValidator,
		colour: colourValidator,
		width: z.number(),
		data: z.record(z.string())
	},
	allPartialUpdate: {
		routePoints: z.array(pointValidator).min(2),
		name: z.string().optional(),
		typeId: idValidator,
		extraInfo: extraInfoValidator.optional()
	},
	exceptCreate: {
		id: idValidator
	},
	onlyRead: {
		...bboxValidator.shape,
		distance: z.number(),
		ascent: z.number().optional(),
		descent: z.number().optional(),
		time: z.number().optional(),
		padId: padIdValidator
	},
	onlyCreate: {
		trackPoints: z.array(trackPointValidator.create)
	}
});
export type Line<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof lineValidator>;
