import type { Colour, Shape } from "facilmap-types";
import { FeatureGroup, latLng, Layer, type LayerOptions } from "leaflet";
import MarkerLayer from "../markers/marker-layer";
import { getSymbolForTags } from "../utils/icons";
import { tooltipOptions } from "../utils/leaflet";
import type { OverpassPreset } from "./overpass-presets";
import { getOverpassElements, isOverpassQueryEmpty, type OverpassElement } from "./overpass-utils";

declare module "leaflet" {
	interface Layer {
		_fmOverpassElement?: OverpassElement;
	}
}

function getElementIdentifier(element: OverpassElement): string {
	return `${element.type}${element.id}`;
}

export enum OverpassLoadStatus {
	COMPLETE = "complete",
	INCOMPLETE = "incomplete",
	TIMEOUT = "timeout",
	ERROR = "error",
	ABORTED = "aborted"
};

export interface OverpassLayerOptions extends LayerOptions {
	markerColour?: Colour;
	markerSize?: number;
	markerShape?: Shape;
	timeout?: number;
	limit?: number;
}

export default class OverpassLayer extends FeatureGroup {

	declare options: OverpassLayerOptions;
	_highlightedElements = new Set<string>();
	_query: string | ReadonlyArray<Readonly<OverpassPreset>> | undefined;
	_lastRequestController?: AbortController;

	constructor(query?: string | ReadonlyArray<Readonly<OverpassPreset>>, options?: OverpassLayerOptions) {
		super([], {
			markerColour: "000000",
			markerSize: 35,
			markerShape: "",
			timeout: 1,
			limit: 50,
			...options
		});

		this._query = query;
	}

	getEvents(): ReturnType<NonNullable<Layer['getEvents']>> {
        return {
            moveend: this.redraw
        };
    }

    onAdd(): this {
        void this.redraw();
        return this;
    }

	isEmpty(): boolean {
		return isOverpassQueryEmpty(this._query);
	}

	getQuery(): string | ReadonlyArray<Readonly<OverpassPreset>> | undefined {
		return this._query;
	}

	setQuery(query?: string | ReadonlyArray<Readonly<OverpassPreset>>): void {
		this._query = query;
		void this.redraw();
		this.fire("setQuery", { query });

		if (this.isEmpty())
			this.fire("clear");
	}

	highlightElement(element: OverpassElement): void {
		const identifier = getElementIdentifier(element);
		for (const layer of this.getLayers()) {
			if (identifier == getElementIdentifier(layer._fmOverpassElement!))
				(layer as MarkerLayer).setStyle({ highlight: true, raised: true });
		}
		this._highlightedElements.add(getElementIdentifier(element));
	}

	unhighlightElement(element: OverpassElement): void {
		const identifier = getElementIdentifier(element);
		for (const layer of this.getLayers()) {
			if (identifier == getElementIdentifier(layer._fmOverpassElement!))
				(layer as MarkerLayer).setStyle({ highlight: false, raised: false });
		}
		this._highlightedElements.delete(getElementIdentifier(element));
	}

	setHighlightedElements(elements: Set<OverpassElement>): void {
		const identifiers = new Set([...elements].map((element) => getElementIdentifier(element)));
		for (const layer of this.getLayers() as MarkerLayer[]) {
			const shouldHighlight = identifiers.has(getElementIdentifier(layer._fmOverpassElement!));
			if (layer.options.highlight != shouldHighlight)
				layer.setStyle({ highlight: shouldHighlight, raised: shouldHighlight });
		}
		this._highlightedElements = new Set([...elements].map((el) => getElementIdentifier(el)));
	}

	_elementToLayer(element: OverpassElement): MarkerLayer {
		const isHighlighted = this._highlightedElements.has(getElementIdentifier(element));
		const layer = new MarkerLayer(latLng(element.lat, element.lon), {
			marker: {
				colour: this.options.markerColour!,
				size: this.options.markerSize!,
				symbol: getSymbolForTags(element.tags),
				shape: this.options.markerShape!
			},
			raised: isHighlighted,
			highlight: isHighlighted
		});
		if (element.tags.name)
			layer.bindTooltip(element.tags.name, { ...tooltipOptions, offset: [ 20, -20 ] })
		layer._fmOverpassElement = element;
		return layer;
	}

    async redraw(): Promise<void> {
		if (this._lastRequestController)
			this._lastRequestController.abort();

		if (!this._map?._loaded)
			return;

		if (this.isEmpty()) {
			this.clearLayers();
			return;
		}

		this.fire("loadstart");

		try {
			this._lastRequestController = new AbortController();
			const elements = await getOverpassElements(this._query!, this._map.getBounds(), this.options.timeout!, this.options.limit!, this._lastRequestController.signal);
			this.clearLayers();
			for (const element of elements)
				this.addLayer(this._elementToLayer(element));
			this.fire("loadend", { status: elements.length < this.options.limit! ? OverpassLoadStatus.COMPLETE : OverpassLoadStatus.INCOMPLETE });
		} catch (error: any) {
			if (error.name == "AbortError") {
				this.fire("loadend", { status: OverpassLoadStatus.ABORTED });
				return;
			}

			this.clearLayers();
			if (error.message.includes("timed out"))
				this.fire("loadend", { status: OverpassLoadStatus.TIMEOUT, error });
			else
				this.fire("loadend", { status: OverpassLoadStatus.ERROR, error });
		}
    }

}