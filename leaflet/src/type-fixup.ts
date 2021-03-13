import "leaflet";

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

    interface GeoJSON {
        // Cannot override this properly
        //constructor(geojson?: Array<geojson.Feature> | geojson.GeoJSON, options?: GeoJSONOptions<P>);
        //addData(geojson: Array<geojson.Feature> | geojson.GeoJSON): this;
    }

    interface Map {
        _loaded?: true;
    }

    export const Hash: any;
}