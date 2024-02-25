import { colourValidator, idValidator, padIdValidator, routeModeValidator, shapeValidator, sizeValidator, symbolValidator, widthValidator } from "./base.js";
import { CRU, type CRUType, cruValidator, onlyUpdate, optionalCreate, exceptCreate, exceptUpdate, optionalUpdate, onlyRead } from "./cru";
import * as z from "zod";

export const objectTypeValidator = z.enum(["marker", "line"]);
export type ObjectType = z.infer<typeof objectTypeValidator>;

export const fieldTypeValidator = z.enum(["textarea", "dropdown", "checkbox", "input"]);
export type FieldType = z.infer<typeof fieldTypeValidator>;

export const fieldOptionValidator = cruValidator({
	value: z.string().trim(),
	colour: colourValidator.optional(),
	size: sizeValidator.optional(),
	symbol: symbolValidator.optional(),
	shape: shapeValidator.optional(),
	width: widthValidator.optional(),

	oldValue: onlyUpdate(z.string().optional())
});
export type FieldOption<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof fieldOptionValidator>;
export type FieldOptionUpdate = FieldOption<CRU.UPDATE>;

export const fieldValidator = cruValidator({
	name: z.string().trim().min(1),
	type: fieldTypeValidator,
	controlColour: z.boolean().optional(),
	default: z.string().optional(),
	controlSize: z.boolean().optional(),
	controlSymbol: z.boolean().optional(),
	controlShape: z.boolean().optional(),
	controlWidth: z.boolean().optional(),

	options: {
		read: z.array(fieldOptionValidator.read).optional(),
		create: z.array(fieldOptionValidator.create).optional(),
		update: z.array(fieldOptionValidator.update).optional()
	},

	oldName: onlyUpdate(z.string().optional())
});

export type Field<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof fieldValidator>;
export type FieldUpdate = Field<CRU.UPDATE>;

const rawTypeValidator = cruValidator({
	id: exceptCreate(idValidator),
	type: exceptUpdate(objectTypeValidator),
	padId: onlyRead(padIdValidator),

	name: optionalUpdate(z.string().trim().min(1).max(100)),

	defaultColour: optionalCreate(colourValidator), // Default value is applied below
	colourFixed: optionalCreate(z.boolean(), false),
	defaultSize: optionalCreate(sizeValidator, 30),
	sizeFixed: optionalCreate(z.boolean(), false),
	defaultSymbol: optionalCreate(symbolValidator, ""),
	symbolFixed: optionalCreate(z.boolean(), false),
	defaultShape: optionalCreate(shapeValidator, ""),
	shapeFixed: optionalCreate(z.boolean(), false),
	defaultWidth: optionalCreate(widthValidator, 4),
	widthFixed: optionalCreate(z.boolean(), false),
	defaultMode: optionalCreate(routeModeValidator, ""),
	modeFixed: optionalCreate(z.boolean(), false),
	showInLegend: optionalCreate(z.boolean(), false),

	fields: {
		read: z.array(fieldValidator.read),
		create: z.array(fieldValidator.create).default(() => [ { name: "Description", type: "textarea" as const } ]),
		update: z.array(fieldValidator.update)
	}
});
export const typeValidator = {
	...rawTypeValidator,
	create: rawTypeValidator.create.transform((type) => {
		return {
			...type,
			defaultColour: type.type === "marker" ? "ff0000" : "0000ff"
		};
	})
};
export type Type<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof typeValidator>;