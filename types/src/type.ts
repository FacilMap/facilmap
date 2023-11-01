import { colourValidator, idValidator, routeModeValidator, shapeValidator, sizeValidator, symbolValidator, widthValidator } from "./base.js";
import { CRU, CRUType, cruValidator } from "./cru";
import { padIdValidator } from "./padData.js";
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
	allPartialUpdate: {
		name: z.string(),
		defaultColour: colourValidator.optional(),
		colourFixed: z.boolean().optional(),
		defaultSize: sizeValidator.optional(),
		sizeFixed: z.boolean().optional(),
		defaultSymbol: symbolValidator.optional(),
		symbolFixed: z.boolean().optional(),
		defaultShape: shapeValidator.optional(),
		shapeFixed: z.boolean().optional(),
		defaultWidth: widthValidator.optional(),
		widthFixed: z.boolean().optional(),
		defaultMode: routeModeValidator.optional(),
		modeFixed: z.boolean().optional(),
		showInLegend: z.boolean().optional(),
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
