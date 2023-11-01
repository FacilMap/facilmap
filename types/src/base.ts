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

export const symbolValidator = z.string();
export type Symbol = z.infer<typeof symbolValidator>;

export const shapeValidator = z.string();
export type Shape = z.infer<typeof shapeValidator>;

export const widthValidator = z.number().min(1);
export type Width = z.infer<typeof widthValidator>;

export const idValidator = z.number();
export type ID = z.infer<typeof idValidator>;

export const routeModeValidator = z.string();
export type RouteMode = z.infer<typeof routeModeValidator>;

export const layerValidator = z.string();
export type Layer = z.infer<typeof layerValidator>;

export const exportFormatValidator = z.enum(["gpx-trk", "gpx-rte"]);
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
