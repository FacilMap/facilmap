import { colourValidator, idValidator, mapIdValidator, routeModeValidator, shapeValidator, sizeValidator, strokeValidator, iconValidator, widthValidator } from "./base.js";
import { CRU, type CRUType, cruValidator, onlyUpdate, optionalCreate, exceptUpdate, optionalUpdate, onlyRead, type CRUValidator } from "./cru";
import * as z from "zod";

export const objectTypeValidator = z.enum(["marker", "line"]);
export type ObjectType = z.infer<typeof objectTypeValidator>;

export const fieldTypeValidator = z.enum(["textarea", "dropdown", "checkbox", "input"]);
export type FieldType = z.infer<typeof fieldTypeValidator>;

export const fieldOptionValidator = cruValidator({
	value: z.string().trim(),
	colour: colourValidator.optional(),
	size: sizeValidator.optional(),
	icon: iconValidator.optional(),
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
/** Applies the "no duplicate option values" refinement to the given fieldOptionsValidator */
export function refineRawFieldOptionsValidator<
	ReadValidator extends z.ZodTypeAny,
	CreateValidator extends z.ZodTypeAny,
	UpdateValidator extends z.ZodTypeAny
>(rawFieldOptionsValidator: CRUValidator<ReadValidator, CreateValidator, UpdateValidator>): CRUValidator<
	z.ZodEffects<ReadValidator, z.output<ReadValidator>, z.input<ReadValidator>>,
	z.ZodEffects<CreateValidator, z.output<CreateValidator>, z.input<CreateValidator>>,
	z.ZodEffects<UpdateValidator, z.output<UpdateValidator>, z.input<UpdateValidator>>
> {
	return {
		read: rawFieldOptionsValidator.read.superRefine(noDuplicateOptionValues),
		create: rawFieldOptionsValidator.create.superRefine(noDuplicateOptionValues),
		update: rawFieldOptionsValidator.update.superRefine(noDuplicateOptionValues)
	};
}
export const fieldOptionsValidator = refineRawFieldOptionsValidator({
	read: z.array(fieldOptionValidator.read),
	create: z.array(fieldOptionValidator.create),
	update: z.array(fieldOptionValidator.update)
});

export const fieldValidator = cruValidator({
	name: z.string().trim().min(1),
	type: fieldTypeValidator,
	default: z.string().optional(),
	controlColour: z.boolean().optional(),
	controlSize: z.boolean().optional(),
	controlIcon: z.boolean().optional(),
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
/** Applies the "no duplicate field names" refinement to the given fieldsValidator. */
export function refineRawFieldsValidator<
	ReadValidator extends z.ZodTypeAny,
	CreateValidator extends z.ZodTypeAny,
	UpdateValidator extends z.ZodTypeAny
>(rawFieldsValidator: CRUValidator<ReadValidator, CreateValidator, UpdateValidator>): CRUValidator<
	z.ZodEffects<ReadValidator, z.output<ReadValidator>, z.input<ReadValidator>>,
	z.ZodEffects<CreateValidator, z.output<CreateValidator>, z.input<CreateValidator>>,
	z.ZodEffects<UpdateValidator, z.output<UpdateValidator>, z.input<UpdateValidator>>
> {
	return {
		read: rawFieldsValidator.read.superRefine(noDuplicateFieldNames),
		create: rawFieldsValidator.create.superRefine(noDuplicateFieldNames),
		update: rawFieldsValidator.update.superRefine(noDuplicateFieldNames)
	};
}
export const fieldsValidator = refineRawFieldsValidator({
	read: z.array(fieldValidator.read),
	create: z.array(fieldValidator.create),
	update: z.array(fieldValidator.update)
});

export const defaultFields = (): Field[] => [ { name: "Description", type: "textarea" as const } ];

/** The type validator without the defaultColour default value applied. */
export const rawTypeValidator = cruValidator({
	id: onlyRead(idValidator),
	type: exceptUpdate(objectTypeValidator),
	mapId: onlyRead(mapIdValidator),

	name: optionalUpdate(z.string().trim().min(1).max(100)),
	idx: optionalCreate(z.number().int().min(0)),

	defaultColour: optionalCreate(colourValidator), // Default value is applied below
	colourFixed: optionalCreate(z.boolean(), false),
	defaultSize: optionalCreate(sizeValidator, 30),
	sizeFixed: optionalCreate(z.boolean(), false),
	defaultIcon: optionalCreate(iconValidator, ""),
	iconFixed: optionalCreate(z.boolean(), false),
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
		create: fieldsValidator.create.default(defaultFields),
		update: fieldsValidator.update.optional()
	}
});
/** Applies the defaultColour default value to the given typeValidator */
export function refineRawTypeValidator<
	ReadValidator extends z.ZodTypeAny,
	CreateValidator extends z.ZodTypeAny,
	UpdateValidator extends z.ZodTypeAny
>(rawTypeValidator: CRUValidator<ReadValidator, CreateValidator, UpdateValidator>): CRUValidator<
	ReadValidator,
	z.ZodEffects<CreateValidator, Omit<z.output<CreateValidator>, "defaultColour"> & { defaultColour: string }, z.input<CreateValidator>>,
	UpdateValidator
> {
	return {
		...rawTypeValidator,
		create: rawTypeValidator.create.transform((type) => {
			return {
				defaultColour: type.type === "marker" ? "ff0000" : "0000ff",
				...type
			};
		})
	};
}
export const typeValidator = refineRawTypeValidator(rawTypeValidator);
export type Type<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof typeValidator>;