import * as z from "zod";

export type ReplaceProperties<T1 extends Record<keyof any, any>, T2 extends Partial<Record<keyof T1, any>>> = Omit<T1, keyof T2> & T2;
export type ReplaceExistingProperties<T1 extends Record<keyof any, any>, T2 extends Record<keyof any, any>> = DistributiveOmit<T1, keyof T2> & DistributivePick<T2, keyof T1>;

/** Deeply converts an interface to a type, see https://stackoverflow.com/a/78441681/242365 */
export type InterfaceToType<T> = {
	[K in keyof T]: InterfaceToType<T[K]>;
}

// export type DeepReadonly<T> = {
// 	readonly [P in keyof T]: DeepReadonly<T[P]>;
// };
export type DeepReadonly<T> = (
	T extends string | number | boolean | bigint | symbol | undefined | null | Function | Date | Error | RegExp ? T :
	T extends Map<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> :
	T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> :
	T extends WeakMap<infer K, infer V> ? WeakMap<DeepReadonly<K>, DeepReadonly<V>> :
	T extends Set<infer U> ? ReadonlySet<DeepReadonly<U>> :
	T extends ReadonlySet<infer U> ? ReadonlySet<DeepReadonly<U>> :
	T extends WeakSet<infer U> ? WeakSet<DeepReadonly<U>> :
	T extends Promise<infer U> ? Promise<DeepReadonly<U>> :
	T extends {} ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
	Readonly<T>
);
export type Mutable<T> = {
	-readonly [P in keyof T]: T[P]
};
export type DeepMutable<T> = (
	T extends string | number | boolean | bigint | symbol | undefined | null | Function | Date | Error | RegExp ? T :
	T extends Map<infer K, infer V> ? Map<DeepMutable<K>, DeepMutable<V>> :
	T extends ReadonlyMap<infer K, infer V> ? Map<DeepMutable<K>, DeepMutable<V>> :
	T extends WeakMap<infer K, infer V> ? WeakMap<DeepMutable<K>, DeepMutable<V>> :
	T extends Set<infer U> ? Set<DeepMutable<U>> :
	T extends ReadonlySet<infer U> ? Set<DeepMutable<U>> :
	T extends WeakSet<infer U> ? WeakSet<DeepMutable<U>> :
	T extends Promise<infer U> ? Promise<DeepMutable<U>> :
	T extends {} ? { -readonly [K in keyof T]: DeepMutable<T[K]> } :
	Mutable<T>
);

export type DistributiveKeyOf<T> = T extends any ? keyof T : never;
export type DistributivePick<T, K extends keyof any> = T extends any ? Pick<T, K & keyof T> : never;
export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

// https://stackoverflow.com/a/76176570/242365
export function fromEntries<const T extends ReadonlyArray<readonly [PropertyKey, unknown]>>(entries: T): { [K in T[number] as K[0] extends `${infer N extends number}` ? N : K[0]]: K[1] } {
	return Object.fromEntries(entries) as any;
}

// https://stackoverflow.com/a/76176570/242365
export function entries<T extends object>(obj: T): { [K in keyof T]: K extends symbol ? never : [K extends number ? `${K}` : K, T[K]] }[keyof T][] {
	return Object.entries(obj) as any;
}

export function keys<T extends object>(obj: T): { [K in keyof T]: K extends symbol ? never : K extends number ? `${K}` : K }[keyof T][] {
	return Object.keys(obj) as any;
}

/**
 * Transform the result of a zod scheme to another type and validates that type against another zod scheme.
 * The result of this function basically equals inputSchema.transform((val) => outputSchema.parse(transformer(val))),
 * but errors thrown during the transformation are handled gracefully (since at the moment, zod transformers
 * do not natively support exceptions).
 */
export function transformValidator<Output, Input1, Input2, Input3>(inputSchema: z.ZodType<Input2, any, Input1>, transformer: (input: Input2) => Input3, outputSchema: z.ZodType<Output, any, Input3>): z.ZodEffects<z.ZodEffects<z.ZodType<Input2, any, Input1>, Input2>, Output> {
	// For now we have to parse the schema twice, since transform() is not allowed to throw exceptions.
	// See https://github.com/colinhacks/zod/pull/420
	return inputSchema.superRefine((val, ctx) => {
		try {
			const result = outputSchema.safeParse(transformer(val));
			if (!result.success) {
				for (const issue of result.error.errors) {
					ctx.addIssue(issue);
				}
			}
		} catch (err: any) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: err.message,
			});
		}
	}).transform((val) => outputSchema.parse(transformer(val)));
}

/**
 * Returns a validator representing a Record<number, any>, picking only number keys from an object. zod does not support these
 * out of the box, since a record key is always a string and thus cannot be validated with z.number().
 */
export function numberRecordValidator<Value extends z.ZodTypeAny>(valueType: Value): z.ZodRecord<z.ZodType<number, any, number>, Value> {
	return transformValidator(z.record(z.any()), (value) => Object.fromEntries(Object.entries(value).filter(([key]) => !isNaN(Number(key)))), z.record(valueType)) as any;
}