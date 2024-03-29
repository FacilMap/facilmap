import * as z from "zod";

/**
 * Represents a "create", "read" or "update" object mode (CRUD without "delete"). Used as a generic, enables to make certain
 * properties optional or unavailable in certain object modes.
 */
export enum CRU {
	READ = "read",
	CREATE = "create",
	CREATE_VALIDATED = "createValidated",
	UPDATE = "update",
	UPDATE_VALIDATED = "updateValidated"
}

type CRUInput = CRU.READ | CRU.CREATE | CRU.UPDATE;

/**
 * A zod validator for each object mode. Easiest to create through the {@link cruValidator()} function.
 */
export type CRUValidator<
	ReadValidator extends z.ZodTypeAny,
	CreateValidator extends z.ZodTypeAny,
	UpdateValidator extends z.ZodTypeAny
> = {
	read: ReadValidator;
	create: CreateValidator;
	update: UpdateValidator
};

/**
 * A validator for each object mode. If a validator is not defined, it means that the property is not present in that object mode.
 * Easiest to be created using one of the helper functions below.
 */
type CRUSingleGranularDeclaration = {
	read?: z.ZodTypeAny;
	create?: z.ZodTypeAny;
	update?: z.ZodTypeAny;
};

type CRUSingleDeclaration = z.ZodTypeAny | CRUSingleGranularDeclaration;

type CRUSingleModeValidatorForDeclaration<T extends CRUSingleDeclaration, Mode extends CRUInput> = (
	T extends CRUSingleGranularDeclaration ? (T[Mode] extends z.ZodTypeAny ? T[Mode] : never) : T
);

type OmitNever<T extends Record<any, any>> = {
	[K in keyof T as T[K] extends never ? never : K]: T[K];
};

type CRUModeValidatorForDeclaration<T extends Record<any, CRUSingleDeclaration>, Mode extends CRUInput> = (
	z.ZodObject<OmitNever<{
		[K in keyof T]: CRUSingleModeValidatorForDeclaration<T[K], Mode>;
	}>>
);

export type CRUValidatorForDeclaration<T extends Record<any, CRUSingleDeclaration>> = {
	read: CRUModeValidatorForDeclaration<T, CRU.READ>;
	create: CRUModeValidatorForDeclaration<T, CRU.CREATE>;
	update: CRUModeValidatorForDeclaration<T, CRU.UPDATE>;
};

function cruModeValidator<T extends Record<any, CRUSingleDeclaration>, Mode extends CRUInput>(declaration: T, mode: Mode): CRUModeValidatorForDeclaration<T, Mode> {
	return z.object(Object.fromEntries(Object.entries(declaration).flatMap(([k, v]) => {
		if (v instanceof z.ZodType) {
			return [[k, v] as const];
		} else if (v[mode]) {
			return [[k, v[mode]!] as const];
		} else {
			return [];
		}
	}))) as any;
}

/**
 * Converts a zod shape to a {@link CRUValidator}. Each property of the zod shape may be a zod validator (to apply the same
 * validator to all object modes) or a {@link CRUSingleGranularDeclaration} (to provide a different validator to each object
 * mode).
 */
export function cruValidator<T extends Record<any, CRUSingleDeclaration>>(declaration: T): CRUValidatorForDeclaration<T> {
	return {
		read: cruModeValidator(declaration, CRU.READ),
		create: cruModeValidator(declaration, CRU.CREATE),
		update: cruModeValidator(declaration, CRU.UPDATE)
	};
}

export type CRUType<Mode extends CRU, Validator extends CRUValidator<any, any, any>> = (
	Mode extends CRU.READ ? z.infer<Validator["read"]> :
	Mode extends CRU.CREATE ? z.input<Validator["create"]> :
	Mode extends CRU.CREATE_VALIDATED ? z.output<Validator["create"]> :
	Mode extends CRU.UPDATE ? z.input<Validator["update"]> :
	Mode extends CRU.UPDATE_VALIDATED ? z.output<Validator["update"]> :
	never
);

/**
 * Creates a CRU validator where the property is only available in read mode.
 */
export function onlyRead<T extends z.ZodTypeAny>(validator: T): { read: T } {
	return { read: validator };
}

/**
 * Creates a CRU validator where the property is only available in create mode.
 */
export function onlyCreate<T extends z.ZodTypeAny>(validator: T): { create: T } {
	return { create: validator };
}

/**
 * Creates a CRU validator where the property is only available in update mode.
 */
export function onlyUpdate<T extends z.ZodTypeAny>(validator: T): { update: T } {
	return { update: validator };
}

/**
 * Creates a CRU validator where the property is only available in create and update mode.
 */
export function exceptRead<T extends z.ZodTypeAny>(validator: T): { create: T; update: T } {
	return { create: validator, update: validator };
}

/**
 * Creates a CRU validator where the property is only available in read and update mode.
 */
export function exceptCreate<T extends z.ZodTypeAny>(validator: T): { read: T; update: T } {
	return { read: validator, update: validator };
}

/**
 * Creates a CRU validator where the property is only available in read and create mode.
 */
export function exceptUpdate<T extends z.ZodTypeAny>(validator: T): { read: T; create: T } {
	return { read: validator, create: validator };
}

/**
 * Create a CRU validator where the property is required in read mode but optional in create and update mode.
 * @param defaultValue If specified, this default value is applied in create mode (not in update mode!)
 */
export function optionalCreate<T extends z.ZodTypeAny, D extends z.infer<T> | undefined = undefined>(validator: T, defaultValue?: D): { read: T; create: D extends undefined ? z.ZodOptional<T> : z.ZodDefault<T>; update: z.ZodOptional<T>; } {
	return {
		read: validator,
		create: defaultValue !== undefined ? validator.default(defaultValue) : validator.optional() as any,
		update: validator.optional()
	};
}

/**
 * Creates a CRU validator where the property is required in read and create mode but optional in update mode.
 */
export function optionalUpdate<T extends z.ZodTypeAny>(validator: T): { read: T; create: T; update: z.ZodOptional<T>; } {
	return {
		read: validator,
		create: validator,
		update: validator.optional()
	};
}

export function mapValues<T extends Record<string, any>, R>(obj: T, mapper: (val: T[keyof T], key: keyof T) => R): Record<keyof T, R> {
	return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, mapper(v, k)])) as any;
}
