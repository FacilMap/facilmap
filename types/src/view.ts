import { bboxValidator, idValidator, layerValidator, padIdValidator } from "./base.js";
import { CRU, CRUType, cruValidator } from "./cru.js";
import * as z from "zod";

export const viewValidator = cruValidator({
	allPartialCreate: {
		filter: z.string().or(z.null())
	},

	allPartialUpdate: {
		...bboxValidator.shape,
		name: z.string(),
		baseLayer: layerValidator,
		layers: z.array(layerValidator)
	},

	exceptCreate: {
		id: idValidator
	},

	onlyRead: {
		padId: padIdValidator
	}
});

export type View<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof viewValidator>;
