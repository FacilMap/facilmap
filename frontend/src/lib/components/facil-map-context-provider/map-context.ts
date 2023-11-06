import type { FindOnMapResult, Point, SearchResult } from "facilmap-types";
import type { BboxHandler, HashHandler, HashQuery, LinesLayer, MarkersLayer, OverpassLayer, OverpassPreset, SearchResultsLayer, VisibleLayers } from "facilmap-leaflet";
import type { LatLng, LatLngBounds, Map } from "leaflet";
import type { FilterFunc } from "facilmap-utils";
import type { Emitter } from "mitt";
import type { DeepReadonly } from "vue";
import type { SelectedItem } from "../../utils/selection";
import type SelectionHandler from "../../utils/selection";

export interface RouteDestination {
	query: string;
	searchSuggestions?: SearchResult[];
	mapSuggestions?: FindOnMapResult[];
	selectedSuggestion?: SearchResult | FindOnMapResult;
}

export type MapContextEvents = {
	"import-file": void;
	"open-selection": { selection: SelectedItem[] };
	"search-set-query": { query: string; zoom?: boolean; smooth?: boolean };
	"route-set-query": { query: string; zoom?: boolean; smooth?: boolean };
	"route-set-from": RouteDestination;
	"route-add-via": RouteDestination;
	"route-set-to": RouteDestination;
	"map-long-click": { point: Point };
};

export interface MapComponents {
	bboxHandler: BboxHandler;
	container: HTMLElement;
	graphicScale: any;
	hashHandler: HashHandler;
	linesLayer: LinesLayer;
	locateControl: L.Control.Locate;
	map: Map;
	markersLayer: MarkersLayer;
	mousePosition: L.Control.MousePosition;
	overpassLayer: OverpassLayer;
	searchResultsLayer: SearchResultsLayer;
	selectionHandler: SelectionHandler;
}

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
	fallbackQuery: HashQuery | undefined;
	setFallbackQuery: (query: HashQuery | undefined) => void;
	interaction: boolean;
	loading: number;
	overpassIsCustom: boolean;
	overpassPresets: OverpassPreset[];
	overpassCustom: string;
	overpassMessage: string | undefined;
	components: MapComponents;
};

export type WritableMapContext = MapContextData & Emitter<MapContextEvents>;

export type MapContext = DeepReadonly<Omit<WritableMapContext, "components">> & {
	readonly components: Readonly<WritableMapContext["components"]>;
};