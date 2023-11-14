import { bboxValidator, idValidator, layerValidator, padIdValidator } from "./base.js";
import { CRU, type CRUType, cruValidator, exceptCreate, onlyRead, optionalUpdate, mapValues, optionalCreate } from "./cru.js";
import * as z from "zod";

export const viewValidator = cruValidator({
	id: exceptCreate(idValidator),
	padId: onlyRead(padIdValidator),

	name: optionalUpdate(z.string().trim()),
	...mapValues(bboxValidator.shape, optionalUpdate),
	baseLayer: optionalUpdate(layerValidator),
	layers: optionalUpdate(z.array(layerValidator)),

	filter: optionalCreate(z.string().or(z.null()), null)
});

export type View<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof viewValidator>;
