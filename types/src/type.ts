import { colourValidator, idValidator, padIdValidator, routeModeValidator, shapeValidator, sizeValidator, symbolValidator, widthValidator } from "./base.js";
import { CRU, type CRUType, cruValidator } from "./cru";
import * as z from "zod";

export const objectTypeValidator = z.enum(["marker", "line"]);
export type ObjectType = z.infer<typeof objectTypeValidator>;

export const fieldTypeValidator = z.enum(["textarea", "dropdown", "checkbox", "input"]);
export type FieldType = z.infer<typeof fieldTypeValidator>;

export const fieldOptionValidator = cruValidator({
	all: {
		value: z.string(),
		colour: colourValidator.optional(),
		size: sizeValidator.optional(),
		symbol: symbolValidator.optional(),
		shape: shapeValidator.optional(),
		width: widthValidator.optional()
	},

	onlyUpdate: {
		oldValue: z.string().optional()
	}
});
export type FieldOption<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof fieldOptionValidator>;
export type FieldOptionUpdate = FieldOption<CRU.UPDATE>;

export const fieldValidator = cruValidator({
	all: {
		name: z.string(),
		type: fieldTypeValidator,
		controlColour: z.boolean().optional(),
		default: z.string().optional(),
		controlSize: z.boolean().optional(),
		controlSymbol: z.boolean().optional(),
		controlShape: z.boolean().optional(),
		controlWidth: z.boolean().optional()
	},

	onlyRead: {
		options: z.array(fieldOptionValidator.read).optional()
	},

	onlyCreate: {
		options: z.array(fieldOptionValidator.create).optional()
	},

	onlyUpdate: {
		oldName: z.string().optional(),
		options: z.array(fieldOptionValidator.update).optional()
	}
});

export type Field<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof fieldValidator>;
export type FieldUpdate = Field<CRU.UPDATE>;

export const typeValidator = cruValidator({
	allPartialCreate: {
		defaultColour: colourValidator.or(z.null()),
		colourFixed: z.boolean().or(z.null()),
		defaultSize: sizeValidator.or(z.null()),
		sizeFixed: z.boolean().or(z.null()),
		defaultSymbol: symbolValidator.or(z.null()),
		symbolFixed: z.boolean().or(z.null()),
		defaultShape: shapeValidator.or(z.null()),
		shapeFixed: z.boolean().or(z.null()),
		defaultWidth: widthValidator.or(z.null()),
		widthFixed: z.boolean().or(z.null()),
		defaultMode: routeModeValidator.or(z.null()),
		modeFixed: z.boolean().or(z.null()),
		showInLegend: z.boolean().or(z.null()),
	},

	allPartialUpdate: {
		name: z.string()
	},

	exceptCreate: {
		id: idValidator
	},

	exceptUpdate: {
		type: objectTypeValidator
	},

	onlyRead: {
		padId: padIdValidator,
		fields: z.array(fieldValidator.read)
	},

	onlyCreate: {
		fields: z.array(fieldValidator.create)
	},

	onlyUpdate: {
		fields: z.array(fieldValidator.update)
	}
});
export type Type<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof typeValidator>;
