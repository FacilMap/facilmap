import type { FilterFunc as _TypeExtensions_FilterFunc } from "facilmap-utils";

// These should really go in other places, but due to https://github.com/microsoft/rushstack/issues/1709, we append
// this file manually to the declarations output during the vite build. Hence the import names need to be unique.

declare module "leaflet" {
	interface Map {
		fmFilter: string | undefined;
		fmFilterFunc: _TypeExtensions_FilterFunc;

		setFmFilter(filter?: string): void;

		_fmLayers?: {
			baseLayers: Record<string, Layer>;
			overlays: Record<string, Layer>;
		}; // (Layers from layers.ts)
	}

	interface FmLayerOptions {
		fmName?: string;
		fmGetName?: () => string;
		fmGetAttribution?: () => string;
	}

	interface LayerOptions extends FmLayerOptions {}
}