import type { Colour, Point, Shape } from "facilmap-types";
import { FeatureGroup, Layer, type LayerOptions, type PathOptions } from "leaflet";
import MarkerLayer from "../markers/marker-layer";
import type { OsmFeatureBlame, OsmFeatureBlameSection } from "facilmap-utils";
import { HighlightablePolyline } from "leaflet-highlightable-layers";

declare module "leaflet" {
	interface Layer {
		_fmBlameSection?: OsmFeatureBlameSection;
	}
}

export interface FeatureBlameLayerOptions extends LayerOptions {
	markerSize?: number;
	markerShape?: Shape;
	pathOptions?: PathOptions;
}

export default class FeatureBlameLayer extends FeatureGroup {

	declare options: FeatureBlameLayerOptions;
	highlightedSections = new Set<OsmFeatureBlameSection>();

	constructor(blame?: OsmFeatureBlame, options?: FeatureBlameLayerOptions) {
		super([], {
			markerSize: 15,
			markerShape: "",
			...options
		});

		if (blame)
			this.setBlame(blame);
	}

	highlightSection(section: OsmFeatureBlameSection): void {
		this.highlightedSections.add(section);
		this.redrawSection(section);
	}

	unhighlightSection(section: OsmFeatureBlameSection): void {
		this.highlightedSections.delete(section);
		this.redrawSection(section);
	}

	setHighlightedSections(sections: Set<OsmFeatureBlameSection>): void {
		for (const section of this.highlightedSections) {
			if (!sections.has(section))
				this.unhighlightSection(section);
		}

		for (const section of sections) {
			if (!this.highlightedSections.has(section))
				this.highlightSection(section);
		}
	}

	redrawSection(section: OsmFeatureBlameSection): void {
		for (const layer of this.getLayers()) {
			if (layer._fmBlameSection && layer._fmBlameSection === section) {
				this.removeLayer(layer);
			}
		}

		for (const layer of this.sectionToLayers(section)) {
			this.addLayer(layer);
		}
	}

	createNodeLayer(point: Point, colour: Colour, highlight: boolean): Layer {
		return new MarkerLayer([point.lat, point.lon], {
			marker: { colour, size: this.options.markerSize!, icon: "", shape: "circle" },
			highlight,
			raised: highlight
		})
	}

	createWayLayer(path: Point[], colour: Colour, highlight: boolean): Layer {
		const weight = this.options.pathOptions?.weight ?? 6;
		return new HighlightablePolyline(path.map((p) => [p.lat, p.lon]), {
			color: `#${colour}`,
			raised: highlight,
			opacity: highlight ? 1 : 0.5,
			outlineColor: "#000000",
			outlineWeight: weight + 2,
			...this.options.pathOptions,
			weight: weight
		});
	}

	sectionToLayers(section: OsmFeatureBlameSection): Layer[] {
		const highlight = this.highlightedSections.has(section);

		return section.paths.map((path) => {
			let layer: Layer;
			if (path.length === 1) {
				// This is an individual node
				layer = this.createNodeLayer(path[0], section.user.colour, highlight);
			} else {
				layer = this.createWayLayer(path, section.user.colour, highlight);
			}
			layer._fmBlameSection = section;
			return layer;
		});
	}

	setBlame(blame: OsmFeatureBlame | undefined): void {
		this.clearLayers();

		if (blame) {
			for (const section of blame.sections) {
				for (const layer of this.sectionToLayers(section)) {
					this.addLayer(layer);
				}
			}
		}
	}

}
