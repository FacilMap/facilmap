import type { Colour, DeepReadonly, Point, Shape } from "facilmap-types";
import { FeatureGroup, Layer, type LayerOptions, type PathOptions } from "leaflet";
import MarkerLayer from "../markers/marker-layer";
import type { AnalyzedOsmRelationSection, ResolvedOsmFeature } from "facilmap-utils";
import { HighlightablePolyline } from "leaflet-highlightable-layers";

export type OsmLayerFeature = ResolvedOsmFeature | AnalyzedOsmRelationSection;

declare module "leaflet" {
	interface Layer {
		_fmOsmFeature?: DeepReadonly<OsmLayerFeature>;
	}
}

export interface OsmLayerOptions extends LayerOptions {
	markerColour?: Colour;
	markerSize?: number;
	markerShape?: Shape;
	pathOptions?: PathOptions;
}

export default class OsmLayer extends FeatureGroup {

	declare options: OsmLayerOptions;
	highlightedFeatures = new Set<DeepReadonly<OsmLayerFeature>>();

	constructor(options?: OsmLayerOptions) {
		super([], {
			markerColour: "0000ff"
			,markerSize: 15,
			markerShape: "",
			...options
		});
	}

	addFeature(feature: DeepReadonly<OsmLayerFeature>): void {
		for (const layer of this.featureToLayers(feature)) {
			this.addLayer(layer);
		}
	}

	removeFeature(feature: DeepReadonly<OsmLayerFeature>): boolean {
		let one = false;
		for (const layer of this.getFeatureLayers(feature)) {
			this.removeLayer(layer);
			one = true;
		}
		return one;
	}

	clearFeatures(): void {
		this.clearLayers();
	}

	getFeatureLayers(feature: DeepReadonly<OsmLayerFeature>): Array<Layer & Required<Pick<Layer, "_fmOsmFeature">>> {
		return this.getLayers().filter((l): l is Layer & Required<Pick<Layer, "_fmOsmFeature">> => l._fmOsmFeature === feature);
	}

	hasFeature(feature: DeepReadonly<OsmLayerFeature>): boolean {
		return this.getLayers().some((l) => l._fmOsmFeature === feature);
	}

	highlightFeature(feature: DeepReadonly<OsmLayerFeature>): void {
		this.highlightedFeatures.add(feature);
		this.redrawFeature(feature);
	}

	unhighlightFeature(feature: DeepReadonly<OsmLayerFeature>): void {
		this.highlightedFeatures.delete(feature);
		this.redrawFeature(feature);
	}

	setHighlightedFeatures(features: Set<DeepReadonly<OsmLayerFeature>>): void {
		for (const feature of this.highlightedFeatures) {
			if (!features.has(feature))
				this.unhighlightFeature(feature);
		}

		for (const feature of features) {
			if (!this.highlightedFeatures.has(feature))
				this.highlightFeature(feature);
		}
	}

	redrawFeature(feature: DeepReadonly<OsmLayerFeature>): void {
		if (this.removeFeature(feature)) {
			this.addFeature(feature);
		}
	}

	createNodeLayer(point: DeepReadonly<Point>, highlight: boolean): Layer {
		return new MarkerLayer([point.lat, point.lon], {
			marker: { colour: this.options.markerColour!, size: this.options.markerSize!, icon: "", shape: "circle" },
			highlight,
			raised: highlight
		})
	}

	createWayLayer(path: DeepReadonly<Point[]>, highlight: boolean): Layer {
		const weight = this.options.pathOptions?.weight ?? 6;
		return new HighlightablePolyline(path.map((p) => [p.lat, p.lon]), {
			raised: highlight,
			opacity: highlight ? 1 : 0.5,
			weight,
			outlineWeight: weight + 2,
			outlineColor: "#000000",
			...this.options.pathOptions
		});
	}

	featureToLayers(feature: DeepReadonly<OsmLayerFeature>): Layer[] {
		const highlight = this.highlightedFeatures.has(feature);

		let layers: Layer[];
		if ("paths" in feature) {
			layers = feature.paths.map((path) => this.createWayLayer(path, highlight));
		} else if (feature.type === "node") {
			layers = [this.createNodeLayer(feature, highlight)];
		} else if (feature.type === "way") {
			layers = [this.createWayLayer(feature.nodes, highlight)];
		} else {
			layers = [];
		}

		for (const layer of layers) {
			layer._fmOsmFeature = feature;
		}

		return layers;
	}

}
