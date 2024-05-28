import { colourValidator, idValidator, pointValidator, shapeValidator, sizeValidator, iconValidator } from "./base.js";
import { CRU, type CRUType, cruValidator, onlyRead, optionalUpdate, mapValues, optionalCreate } from "./cru";
import * as z from "zod";

export const markerValidator = cruValidator({
	id: onlyRead(idValidator),
	mapId: onlyRead(idValidator),
	...mapValues(pointValidator.shape, optionalUpdate),
	typeId: optionalUpdate(idValidator),
	name: optionalCreate(z.string().trim().max(100), ""),
	icon: optionalCreate(iconValidator), // defaults to type.defaultIcon
	shape: optionalCreate(shapeValidator), // defaults to type.defaultShape
	colour: optionalCreate(colourValidator), // defaults to type.defaultColour
	size: optionalCreate(sizeValidator), // defaults to type.defaultSize
	data: optionalCreate(z.record(z.string())),
	ele: optionalCreate(z.number().or(z.null()))
});
export type Marker<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof markerValidator>;
