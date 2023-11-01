import { bboxValidator, idValidator, layerValidator } from "./base.js";
import { padIdValidator } from "./padData.js";
import { CRU, CRUType, cruValidator } from "./cru.js";
import * as z from "zod";

export const viewValidator = cruValidator({
	allPartialUpdate: {
		...bboxValidator.shape,
		name: z.string(),
		baseLayer: layerValidator,
		layers: z.array(layerValidator),
		filter: z.string().optional()
	},

	exceptCreate: {
		id: idValidator
	},

	onlyRead: {
		padId: padIdValidator
	}
});

export type View<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof viewValidator>;
