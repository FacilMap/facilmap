import "leaflet";

declare module "leaflet" {
    interface Layer {
        options: LayerOptions;
    }

	interface Map {
		_controlCorners: any;
		_controlContainer: any;
		_loaded?: true;
	}

	namespace control {
		export const graphicScale: any;
	}
}