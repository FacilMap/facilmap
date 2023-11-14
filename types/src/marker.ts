import { colourValidator, idValidator, padIdValidator, pointValidator, shapeValidator, sizeValidator, symbolValidator } from "./base.js";
import { CRU, type CRUType, cruValidator, exceptCreate, onlyRead, optionalUpdate, mapValues, optionalCreate } from "./cru";
import * as z from "zod";

export const markerValidator = cruValidator({
	id: exceptCreate(idValidator),
	padId: onlyRead(padIdValidator),
	...mapValues(pointValidator.shape, optionalUpdate),
	typeId: optionalUpdate(idValidator),
	name: optionalCreate(z.string().trim(), ""),
	symbol: optionalCreate(symbolValidator), // defaults to type.defaultSymbol
	shape: optionalCreate(shapeValidator), // defaults to type.defaultShape
	colour: optionalCreate(colourValidator), // defaults to type.defaultColour
	size: optionalCreate(sizeValidator), // defaults to type.defaultSize
	data: optionalCreate(z.record(z.string())),
	ele: optionalCreate(z.number().or(z.null()), null)
});
export type Marker<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof markerValidator>;
