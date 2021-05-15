import { Colour, Shape } from "facilmap-types";
import { FeatureGroup, latLng, latLngBounds, LatLngBounds, Layer, LayerOptions } from "leaflet";
import MarkerLayer from "../markers/marker-layer";
import { getSymbolForTags } from "../utils/icons";
import { tooltipOptions } from "../utils/leaflet";
import { OverpassPreset } from "./overpass-presets";

const OVERPASS_API = "https://overpass.kumi.systems/api/interpreter";

declare module "leaflet" {
	interface Layer {
		_fmOverpassElement?: OverpassElement;
	}
}

export interface OverpassElement {
	id: number;
	tags?: Record<string, string>;
	type: "node" | "way" | "relation";
	lat: number;
	lon: number;
};

export function quoteOverpassString(str: string): string {
	return `"${str.replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;
}

export function getOverpassBbox(bbox: LatLngBounds): string {
	return [bbox.getSouth(), bbox.getWest(), bbox.getNorth(), bbox.getEast()].join(",");
}

export async function getOverpassElements(query: string | OverpassPreset[], bbox: LatLngBounds, timeout: number, limit: number, signal?: AbortSignal): Promise<OverpassElement[]> {
	const normalizedQuery = typeof query == "string" ? `${query}${query[query.length - 1] == ";" ? "" : ";"}` : `(${query.map((q) => `${q.query};`).join("")});`;
	const data = `[out:json][timeout:${timeout}][bbox:${getOverpassBbox(bbox)}];${normalizedQuery}out center ${limit};`;

	const response = await fetch(`${OVERPASS_API}?data=${encodeURIComponent(data)}`, { signal });
	if (response.headers.get("Content-type")?.includes("text/html")) {
		const html = (new DOMParser()).parseFromString(await response.text(), "text/html");
		const errors = [...html.querySelectorAll("p")].flatMap((p) => (p.innerText.includes("Error") ? [p.innerText] : []));
		throw new Error(errors.join("\n"));
	}

	const result = await response.json();
	if (result.elements.length == 0 && result.remark)
		throw new Error(result.remark);

	return result.elements.map((element: any) => ({
		...element,
		...(element.center ? element.center : {})
	}));
}

export async function validateOverpassQuery(query: string, signal?: AbortSignal): Promise<string | undefined> {
	try {
		await getOverpassElements(query, latLngBounds([0, 0], [0, 0]), 1, 1, signal);
		return undefined;
	} catch (e) {
		return e.message;
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

	options!: OverpassLayerOptions;
	_highlightedElements = new Set<string>();
	_query: string | OverpassPreset[] | undefined;
	_lastRequestController?: AbortController;

	constructor(query?: string | OverpassPreset[], options?: OverpassLayerOptions) {
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
        this.redraw();
        return this;
    }

	isEmpty(): boolean {
		return !this._query || (Array.isArray(this._query) && this._query.length == 0);
	}

	getQuery(): string | OverpassPreset[] | undefined {
		return this._query;
	}

	setQuery(query?: string | OverpassPreset[]): void {
		this._query = query;
		this.redraw();
		this.fire("setQuery", { query });
	}

	highlightElement(element: OverpassElement): void {
		const identifier = getElementIdentifier(element);
		for (const layer of this.getLayers()) {
			if (identifier == getElementIdentifier(layer._fmOverpassElement!))
				(layer as MarkerLayer).setStyle({ highlight: true, raised: true });
		}
	}

	unhighlightElement(element: OverpassElement): void {
		const identifier = getElementIdentifier(element);
		for (const layer of this.getLayers()) {
			if (identifier == getElementIdentifier(layer._fmOverpassElement!))
				(layer as MarkerLayer).setStyle({ highlight: false, raised: false });
		}
	}

	setHighlightedElements(elements: Set<OverpassElement>): void {
		const identifiers = new Set([...elements].map((element) => getElementIdentifier(element)));
		for (const layer of this.getLayers() as MarkerLayer[]) {
			const shouldHighlight = identifiers.has(getElementIdentifier(layer._fmOverpassElement!));
			if (layer.options.highlight != shouldHighlight)
				layer.setStyle({ highlight: shouldHighlight, raised: shouldHighlight });
		}
	}

	_elementToLayer(element: OverpassElement): MarkerLayer {
		const isHighlighted = this._highlightedElements.has(getElementIdentifier(element));
		const layer = new MarkerLayer(latLng(element.lat, element.lon), {
			marker: {
				colour: this.options.markerColour!,
				size: this.options.markerSize!,
				symbol: (element.tags && getSymbolForTags(element.tags)) || '',
				shape: this.options.markerShape!
			},
			raised: isHighlighted,
			highlight: isHighlighted
		});
		if (element.tags?.name)
			layer.bindTooltip(element.tags.name, { ...tooltipOptions, offset: [ 20, -20 ] })
		layer._fmOverpassElement = element;
		return layer;
	}

    async redraw(): Promise<void> {
		if (this._lastRequestController)
			this._lastRequestController.abort();

		if (!this._map._loaded)
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
		} catch (error) {
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