import * as z from "zod";

export const latitudeValidator = z.number().min(-90).max(90);
export type Latitude = z.infer<typeof latitudeValidator>;

export const longitudeValidator = z.number();
export type Longitude = z.infer<typeof longitudeValidator>;

export const zoomLevelValidator = z.number();
export type ZoomLevel = z.infer<typeof zoomLevelValidator>;

export const colourValidator = z.string().regex(/^[0-9a-f]{6}$/i);
/** Colour in 6-digit hex format without a # */
export type Colour = z.infer<typeof colourValidator>;

export const sizeValidator = z.number().min(15);
export type Size = z.infer<typeof sizeValidator>;

export const iconValidator = z.string().trim();
export type Icon = z.infer<typeof iconValidator>;

export const shapeValidator = z.string().trim();
export type Shape = z.infer<typeof shapeValidator>;

export const widthValidator = z.number().min(1);
export type Width = z.infer<typeof widthValidator>;

export const strokeValidator = z.enum(["", "dashed", "dotted"]);
export type Stroke = z.infer<typeof strokeValidator>;

export const stringifiedIdValidator = z.coerce.number().int().transform(Number);
export const idValidator = z.number().int();
export type ID = z.infer<typeof idValidator>;

export const mapSlugValidator = z.string()
	.min(1)
	.max(100)
	.refine((val) => !val.includes("/"), { message: "May not contain a slash." })
	.refine((val) => !val.startsWith("_"), { message: "May not start with an underscore." })
	.refine((val) => !val.startsWith("."), { message: "May not start with a period." });
export type MapSlug = z.infer<typeof mapSlugValidator>;

export const mapIdValidator = mapSlugValidator;
export type MapId = MapSlug; // Will be changed later

export const routeModeValidator = z.string();
export type RouteMode = z.infer<typeof routeModeValidator>;

export const layerValidator = z.string();
export type Layer = z.infer<typeof layerValidator>;

export const exportFormatValidator = z.enum(["gpx-trk", "gpx-rte", "geojson"]);
export type ExportFormat = z.infer<typeof exportFormatValidator>;

export const pointValidator = z.object({
	lat: latitudeValidator,
	lon: longitudeValidator
});
export type Point = z.infer<typeof pointValidator>;

export const bboxValidator = z.object({
	top: latitudeValidator,
	bottom: latitudeValidator,
	left: longitudeValidator,
	right: longitudeValidator
});
export type Bbox = z.infer<typeof bboxValidator>;

export const bboxWithZoomValidator = bboxValidator.extend({
	zoom: zoomLevelValidator
});
export type BboxWithZoom = z.infer<typeof bboxWithZoomValidator>;

export const objectWithIdValidator = z.object({
	id: idValidator
});
export type ObjectWithId = z.infer<typeof objectWithIdValidator>;

export enum Units {
	METRIC = "metric",
	US_CUSTOMARY = "us_customary"
}
export const unitsValidator = z.nativeEnum(Units);

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