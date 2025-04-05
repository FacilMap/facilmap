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