import { SearchResult } from "facilmap-types";
import { FeatureGroup, Layer, LayerOptions } from "leaflet";
import MarkerLayer from "../markers/marker-layer";
import { tooltipOptions } from "../utils/leaflet";
import SearchResultGeoJSON from "./search-result-geojson";

declare module "leaflet" {
	interface Layer {
		_fmSearchResult?: SearchResult;
	}
}

const searchMarkerColour = "000000";
const searchMarkerSize = 35;

interface SearchResultsLayerOptions extends LayerOptions {
	weight?: number;
}

export default class SearchResultsLayer extends FeatureGroup {

	options!: SearchResultsLayerOptions;
	highlightedResults = new Set<SearchResult>();

	constructor(results?: SearchResult[], options?: SearchResultsLayerOptions) {
		super([], options);

		if (results)
			this.setResults(results);
	}

	highlightResult(result: SearchResult): void {
		this.highlightedResults.add(result);
		this.redrawResult(result);
	}

	unhighlightResult(result: SearchResult): void {
		this.highlightedResults.delete(result);
		this.redrawResult(result);
	}

	setHighlightedResults(results: Set<SearchResult>): void {
		for (const result of this.highlightedResults) {
			if (!results.has(result))
				this.unhighlightResult(result);
		}

		for (const result of results) {
			if (!this.highlightedResults.has(result))
				this.highlightResult(result);
		}
	}

	redrawResult(result: SearchResult): void {
		for (const layer of this.getLayers().filter((layer) => layer._fmSearchResult === result)) {
			this.removeLayer(layer);
		}
		
		for (const layer of this.resultToLayers(result)) {
			this.addLayer(layer);
		}
	}

	resultToLayers(result: SearchResult): Layer[] {
		const layers: Layer[] = [];

		const highlight = this.highlightedResults.has(result);

		if(!result.lat || !result.lon || (result.geojson && result.geojson.type != "Point")) { // If the geojson is just a point, we already render our own marker
			const layer = new SearchResultGeoJSON(result.geojson!, {
				raised: highlight,
				highlight,
				marker: {
					colour: searchMarkerColour,
					size: searchMarkerSize,
					symbol: result.icon || '',
					shape: ''
				},
				weight: this.options.weight
			}).bindTooltip(result.display_name, { ...tooltipOptions, sticky: true, offset: [ 20, 0 ] })
			layer._fmSearchResult = result;
			layer.eachLayer((l) => {
				l._fmSearchResult = result;
			});
			layers.push(layer);
		}
	
		if(result.lat != null && result.lon != null) {
			const marker = new MarkerLayer([ result.lat, result.lon ], {
				raised: highlight,
				highlight,
				marker: {
					colour: searchMarkerColour,
					size: searchMarkerSize,
					symbol: result.icon || '',
					shape: ''
				}
			}).bindTooltip(result.display_name, { ...tooltipOptions, offset: [ 20, 0 ] })
			marker._fmSearchResult = result;
			layers.push(marker);
		}

		return layers;
	}

	setResults(results: SearchResult[]): void {
		this.clearLayers();

		for (const result of results) {
			for (const layer of this.resultToLayers(result)) {
				this.addLayer(layer);
			}
		}
	}

}
