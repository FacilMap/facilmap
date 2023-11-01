import { colourValidator, idValidator, pointValidator, shapeValidator, sizeValidator, symbolValidator } from "./base.js";
import { CRU, CRUType, cruValidator } from "./cru";
import { padIdValidator } from "./padData.js";
import * as z from "zod";

export const markerValidator = cruValidator({
	allPartialCreate: {
		colour: colourValidator,
		size: sizeValidator,
		data: z.record(z.string())
	},
	allPartialUpdate: {
		...pointValidator.shape,
		name: z.string().optional(),
		symbol: symbolValidator.optional(),
		shape: shapeValidator.optional(),
		ele: z.number().optional(),
		typeId: idValidator
	},
	exceptCreate: {
		id: idValidator
	},
	onlyRead: {
		padId: padIdValidator
	}
});
export type Marker<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof markerValidator>;
