import "leaflet";

declare module "leaflet" {
	interface LayerOptions {
		zIndex?: number;
		noWrap?: boolean;
	}

	interface GridLayerOptions extends LayerOptions {}

	interface Layer {
		_tooltip?: Tooltip;
		options: LayerOptions;
		addInteractiveTarget(targetEl: HTMLElement): void;
		removeInteractiveTarget(targetEl: HTMLElement): void;
	}

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
		_layers: Record<string, Layer>;
		getPixelBounds(latlng?: LatLngExpression, zoom?: number): Bounds;
	}
}