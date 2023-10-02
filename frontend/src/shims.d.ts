declare module "vue-color" {
	export const ColorMixin: any;
	export const Hue: any;
	export const Saturation: any;
}

declare module "@tmcw/togeojson" {
	export const gpx: any;
	export const kml: any;
	export const tcx: any;
}

declare module "vue-nonreactive" {
	export default function nonreactive(obj: ConstructorType<Vue>): void;
}