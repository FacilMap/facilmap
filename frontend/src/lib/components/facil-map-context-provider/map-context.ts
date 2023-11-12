import type { BboxHandler, HashHandler, HashQuery, LinesLayer, MarkersLayer, OverpassLayer, OverpassPreset, SearchResultsLayer, VisibleLayers } from "facilmap-leaflet";
import type { LatLng, LatLngBounds, Map } from "leaflet";
import type { FilterFunc } from "facilmap-utils";
import type { Emitter } from "mitt";
import type { DeepReadonly } from "vue";
import type { SelectedItem } from "../../utils/selection";
import type SelectionHandler from "../../utils/selection";

export type MapContextEvents = {
	"open-selection": { selection: DeepReadonly<SelectedItem[]> };
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
	selection: DeepReadonly<SelectedItem>[];
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
	loaded: boolean;
	fatalError: string | undefined;
};

export type WritableMapContext = MapContextData & Emitter<MapContextEvents>;

export type MapContext = DeepReadonly<Omit<WritableMapContext, "components">> & {
	readonly components: Readonly<WritableMapContext["components"]>;
};