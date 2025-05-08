import { colourValidator, idValidator, routeModeValidator, shapeValidator, sizeValidator, strokeValidator, iconValidator, widthValidator, type ID } from "./base.js";
import { CRU, type CRUType, cruValidator, onlyUpdate, optionalCreate, exceptUpdate, optionalUpdate, onlyRead, type CRUValidator, exceptCreate } from "./cru.js";
import * as z from "zod";
import { entries, type DeepReadonly } from "./utility.js";

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
	update: z.array(fieldOptionValidator.create.or(fieldOptionValidator.update))
});

export const fieldValidator = cruValidator({
	id: exceptCreate(idValidator),
	name: z.string().trim().min(1),
	type: fieldTypeValidator,
	default: z.string().optional(),
	controlColour: z.boolean().optional(),
	controlSize: z.boolean().optional(),
	controlIcon: z.boolean().optional(),
	controlShape: z.boolean().optional(),
	controlWidth: z.boolean().optional(),
	controlStroke: z.boolean().optional(),
	showInLegend: z.boolean().optional(),

	options: {
		read: fieldOptionsValidator.read.optional(),
		create: fieldOptionsValidator.create.optional(),
		update: fieldOptionsValidator.update.optional()
	}
});

export type Field<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof fieldValidator>;
export type FieldUpdate = Field<CRU.UPDATE>;

const noDuplicateFields = (fields: Array<Field<CRU>>, ctx: z.RefinementCtx) => {
	const fieldIds: Record<string, number> = {};
	const fieldNames: Record<string, number> = {};
	for (const field of fields) {
		if ("id" in field) {
			fieldIds[field.id] = (fieldIds[field.id] ?? 0) + 1;
		}
		fieldNames[field.name] = (fieldNames[field.name] ?? 0) + 1;
	}

	for (let i = 0; i < fields.length; i++) {
		const field = fields[i];
		if ("id" in field) {
			if (fieldIds[field.id] > 1) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Field IDs must be unique.",
					path: [i, "id"]
				});
			}
		}

		if (fieldNames[field.name] > 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Field names must be unique.",
				path: [i, "name"]
			});
		}
	}
};
/** Applies the "no duplicate fields" refinements to the given fieldsValidator. */
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
		read: rawFieldsValidator.read.superRefine(noDuplicateFields),
		create: rawFieldsValidator.create.superRefine(noDuplicateFields),
		update: rawFieldsValidator.update.superRefine(noDuplicateFields)
	};
}
export const fieldsValidator = refineRawFieldsValidator({
	read: z.array(fieldValidator.read),
	create: z.array(fieldValidator.create),
	update: z.array(fieldValidator.create.or(fieldValidator.update))
});

export const defaultFields = (): Field<CRU.CREATE>[] => [{ name: "Description", type: "textarea" as const } ];

/** The type validator without the defaultColour default value applied. */
export const rawTypeValidator = cruValidator({
	id: onlyRead(idValidator),
	type: exceptUpdate(objectTypeValidator),
	mapId: onlyRead(idValidator),

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
	},

	/** Field ID by name of deleted fields. Key: field name, value: field ID */
	formerFieldIds: onlyRead(z.record(idValidator))
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

/**
 * Converts a string record that maps field names to field values to a record that maps field names to field
 * values (as in the data property of markers and lines).
 */
export function dataByNameToDataByFieldId(data: Record<string, string>, type: DeepReadonly<Type>): Record<ID, string> {
	const fieldIds = new Map([
		...Object.entries(type.formerFieldIds),
		...type.fields.map((f) => [f.name, f.id] as const)
	]);
	return Object.assign(new Object(null), Object.fromEntries(Object.entries(data).map(([name, value]) => (
		fieldIds.has(name) ? [fieldIds.get(name)!, value] : [name, value]
	))));
}

/**
 * Converts a string record that maps field IDs to field values (as in the data property of markers and lines) to
 * a record that maps field names to field values.
 */
export function dataByFieldIdToDataByName(data: Record<ID, string>, type: DeepReadonly<Type>): Record<string, string> {
	const fieldNames = new Map([
		...Object.entries(type.formerFieldIds).map(([name, fieldId]) => [`${fieldId}`, name] as const),
		...type.fields.map((f) => [`${f.id}`, f.name] as const)
	]);
	return Object.assign(new Object(null), Object.fromEntries(entries(data).map(([fieldId, value]) => (
		fieldNames.has(fieldId) ? [fieldNames.get(fieldId)!, value] : [fieldId, value]
	))));
}