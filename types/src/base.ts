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

export const forbiddenMapSlugs = ["robots.txt", "favicon.ico"];
export const mapSlugOrJwtValidator = z.string()
	.min(1)
	.max(100)
	.refine((val) => !val.includes("/"), { message: "May not contain a slash." })
	.refine((val) => !val.includes("\n"), { message: "May not contain a newline." })
	.refine((val) => !val.startsWith("_"), { message: "May not start with an underscore." })
	.refine((val) => !val.startsWith("."), { message: "May not start with a period." })
	.refine((val) => !forbiddenMapSlugs.includes(val), { message: "This map slug is not permitted." });
export const mapSlugValidator = mapSlugOrJwtValidator.refine((val) => !isMapToken(val), { message: "May not be a map token." });
export type MapSlug = z.infer<typeof mapSlugValidator>;

export const routeModeValidator = z.string();
export type RouteMode = z.infer<typeof routeModeValidator>;

export const layerValidator = z.string();
export type Layer = z.infer<typeof layerValidator>;

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

export function isMapToken(mapSlug: string): boolean {
	return !!mapSlug.match(/^[-_a-zA-Z0-9]+(\.[-_a-zA-Z0-9]+){3,4}$/);
}

declare const strippedObjectMarker: unique symbol;
/**
 * An object that is marked as "stripped", meaning that properties have been removed from it that the user is not supposed
 * to see. This is a safety mechanism used in the API implementation to make sure that no unstripped data is sent by accident.
 * It is a pure TypeScript mechanism, the actual underlying objects are not modified.
 */
export type Stripped<T> = T & {
	[strippedObjectMarker]: true
};
export function markStripped<T>(object: T): Stripped<T> {
	return object as any;
}