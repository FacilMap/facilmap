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

	interface Control {
		_container: HTMLElement;
	}

	interface LeafletEvent {
		originalEvent: Event;
	}

	interface Handler {
        _map: Map;
		_enabled?: boolean;
    }

	/*
	interface lagLngBounds {
		(): LatLngBounds;
	}
	*/

	namespace control {
		export const graphicScale: any;
	}

	namespace Control {
		const Heightgraph: any;
	}

	namespace Draggable {
		const _dragging: Draggable;
	}

	namespace Map {
		const BoxZoom: any;
	}
}

declare module "vue" {
	interface VueConstructor {
		// Injected by vue-nonreactive
		nonreactive<T>(obj: T): T;
	}
}