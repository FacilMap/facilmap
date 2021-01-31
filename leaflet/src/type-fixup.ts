import { GridLayerOptions, Layer, Map } from "leaflet";

declare module "leaflet" {
    interface LayerOptions {
        zIndex?: number;
        noWrap?: boolean;
    }

    interface GridLayerOptions extends LayerOptions {}

    interface Layer {
        options: LayerOptions;
        addInteractiveTarget(targetEl: HTMLElement): void;
        removeInteractiveTarget(targetEl: HTMLElement): void;
    }

    export const GeometryUtil: any;

    interface Handler {
        _map: Map;
    }

    interface Marker {
        _initIcon(): void;
    }

    interface MarkerClusterGroup {
        options: MarkerClusterGroupOptions;
    }

    export const Hash: any;
}