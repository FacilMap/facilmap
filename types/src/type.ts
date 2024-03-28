import { colourValidator, idValidator, padIdValidator, routeModeValidator, shapeValidator, sizeValidator, strokeValidator, symbolValidator, widthValidator } from "./base.js";
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
	stroke: strokeValidator.optional(),

	oldValue: onlyUpdate(z.string().optional())
});
export type FieldOption<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof fieldOptionValidator>;
export type FieldOptionUpdate = FieldOption<CRU.UPDATE>;

const noDuplicateOptionValues = (options: Array<FieldOption<CRU>>, ctx: z.RefinementCtx) => {
	const values: Record<string, number> = {};
	for (const option of options) {
		values[option.value] = (values[option.value] ?? 0) + 1;
	}

	for (let i = 0; i < options.length; i++) {
		if (values[options[i].value] > 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Dropdown option values must be unique.",
				path: [i, "value"]
			});
		}
	}
};
export const fieldOptionsValidator = {
	read: z.array(fieldOptionValidator.read).superRefine(noDuplicateOptionValues),
	create: z.array(fieldOptionValidator.create).superRefine(noDuplicateOptionValues),
	update: z.array(fieldOptionValidator.update).superRefine(noDuplicateOptionValues)
};

export const fieldValidator = cruValidator({
	name: z.string().trim().min(1),
	type: fieldTypeValidator,
	default: z.string().optional(),
	controlColour: z.boolean().optional(),
	controlSize: z.boolean().optional(),
	controlSymbol: z.boolean().optional(),
	controlShape: z.boolean().optional(),
	controlWidth: z.boolean().optional(),
	controlStroke: z.boolean().optional(),

	options: {
		read: fieldOptionsValidator.read.optional(),
		create: fieldOptionsValidator.create.optional(),
		update: fieldOptionsValidator.update.optional()
	},

	oldName: onlyUpdate(z.string().optional())
});

export type Field<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof fieldValidator>;
export type FieldUpdate = Field<CRU.UPDATE>;

const noDuplicateFieldNames = (fields: Array<Field<CRU>>, ctx: z.RefinementCtx) => {
	const fieldNames: Record<string, number> = {};
	for (const field of fields) {
		fieldNames[field.name] = (fieldNames[field.name] ?? 0) + 1;
	}

	for (let i = 0; i < fields.length; i++) {
		if (fieldNames[fields[i].name] > 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Field names must be unique.",
				path: [i, "name"]
			});
		}
	}
};
export const fieldsValidator = {
	read: z.array(fieldValidator.read).superRefine(noDuplicateFieldNames),
	create: z.array(fieldValidator.create).superRefine(noDuplicateFieldNames),
	update: z.array(fieldValidator.update).superRefine(noDuplicateFieldNames)
};

const rawTypeValidator = cruValidator({
	id: exceptCreate(idValidator),
	type: exceptUpdate(objectTypeValidator),
	padId: onlyRead(padIdValidator),

	name: optionalUpdate(z.string().trim().min(1).max(100)),
	idx: optionalCreate(z.number().int().min(0)),

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
	defaultStroke: optionalCreate(strokeValidator, ""),
	strokeFixed: optionalCreate(z.boolean(), false),
	defaultMode: optionalCreate(routeModeValidator, ""),
	modeFixed: optionalCreate(z.boolean(), false),
	showInLegend: optionalCreate(z.boolean(), false),

	fields: {
		read: fieldsValidator.read,
		create: fieldsValidator.create.default(() => [ { name: "Description", type: "textarea" as const } ]),
		update: fieldsValidator.update.optional()
	}
});
export const typeValidator = {
	...rawTypeValidator,
	create: rawTypeValidator.create.transform((type) => {
		return {
			defaultColour: type.type === "marker" ? "ff0000" : "0000ff",
			...type
		};
	})
};
export type Type<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof typeValidator>;