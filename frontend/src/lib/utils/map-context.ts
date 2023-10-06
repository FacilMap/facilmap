import { InjectionKey, Ref, inject, provide } from "vue";
import mitt, { Emitter } from "mitt";
import { LatLng, LatLngBounds } from "leaflet";
import { HashQuery, OverpassPreset, VisibleLayers } from "facilmap-leaflet";
import { FilterFunc } from "facilmap-utils";
import { SelectedItem } from "./selection";
import { FindOnMapResult, Point, SearchResult } from "facilmap-types";

export type MapContextEvents = {
	"import-file": void;
	"open-selection": { selection: SelectedItem[] };
	"search-box-show-tab": { id: string; expand?: boolean };
	"search-set-query": { query: string; zoom?: boolean; smooth?: boolean };
	"route-set-query": { query: string; zoom?: boolean; smooth?: boolean };
	"route-set-from": { query: string; searchSuggestions?: SearchResult[]; mapSuggestions?: FindOnMapResult[]; selectedSuggestion?: SearchResult | FindOnMapResult };
	"route-add-via": { query: string; searchSuggestions?: SearchResult[]; mapSuggestions?: FindOnMapResult[]; selectedSuggestion?: SearchResult | FindOnMapResult };
	"route-set-to": { query: string; searchSuggestions?: SearchResult[]; mapSuggestions?: FindOnMapResult[]; selectedSuggestion?: SearchResult | FindOnMapResult };
	"map-long-click": { point: Point };
};

export type MapContextData = {
	center: LatLng;
	zoom: number;
	bounds: LatLngBounds;
	layers: VisibleLayers;
	filter: string | undefined;
	filterFunc: FilterFunc;
	hash: string;
	showToolbox: boolean;
	selection: SelectedItem[];
	activeQuery: HashQuery | undefined;
	fallbackQuery: HashQuery | undefined; // Updated by search-box
	interaction: boolean;
	loading: number;
	overpassIsCustom: boolean;
	overpassPresets: OverpassPreset[];
	overpassCustom: string;
	overpassMessage: string | undefined;
};

export type MapContext = MapContextData & Emitter<MapContextEvents>

const mapContextInject = Symbol("mapContextInject") as InjectionKey<Ref<MapContext | undefined>>;

export function createMapContext(data: MapContextData): MapContext {
	return Object.assign(mitt<MapContextEvents>(), data);
}

export function provideMapContext(mapContext: Ref<MapContext | undefined>): void {
	return provide(mapContextInject, mapContext);
}

export function injectMapContextOptional(): Ref<MapContext | undefined> | undefined {
	return inject(mapContextInject);
}

export function injectMapContextRequired(): Ref<MapContext> {
	const mapContext = injectMapContextOptional();
	if (!mapContext || !mapContext.value) {
		throw new Error("No map context injected.");
	}
	return mapContext as Ref<MapContext>;
}