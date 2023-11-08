import { colourValidator, idValidator, padIdValidator, pointValidator, shapeValidator, sizeValidator, symbolValidator } from "./base.js";
import { CRU, type CRUType, cruValidator } from "./cru";
import * as z from "zod";

export const markerValidator = cruValidator({
	allPartialCreate: {
		name: z.string(),
		symbol: symbolValidator.or(z.null()),
		shape: shapeValidator.or(z.null()),
		ele: z.number().or(z.null()),
		colour: colourValidator,
		size: sizeValidator,
		data: z.record(z.string())
	},
	allPartialUpdate: {
		...pointValidator.shape,
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
