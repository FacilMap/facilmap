import { EventHandler, EventName, FindOnMapResult, Point, SearchResult } from "facilmap-types";
import Vue from "vue";
import { SelectedItem } from "../../utils/selection";

export interface MapContextEvents {
	"fm-import-file": []
	"fm-open-selection": [selection: SelectedItem[]],
	"fm-search-box-show-tab": [id: string, expand?: boolean];
	"fm-route-set-query": [query: string];
	"fm-route-set-from": [query: string, searchSuggestions?: SearchResult[], mapSuggestions?: FindOnMapResult[], selectedSuggestion?: SearchResult | FindOnMapResult];
	"fm-route-add-via": [query: string, searchSuggestions?: SearchResult[], mapSuggestions?: FindOnMapResult[], selectedSuggestion?: SearchResult | FindOnMapResult];
	"fm-route-set-to": [query: string, searchSuggestions?: SearchResult[], mapSuggestions?: FindOnMapResult[], selectedSuggestion?: SearchResult | FindOnMapResult];
	"fm-map-click": [point: Point];
}

export interface EventBus {
	$on<E extends EventName<MapContextEvents>>(event: E, callback: EventHandler<MapContextEvents, E>): void;
	$once<E extends EventName<MapContextEvents>>(event: E, callback: EventHandler<MapContextEvents, E>): void;
	$off<E extends EventName<MapContextEvents>>(event: E, callback: EventHandler<MapContextEvents, E>): void;
	$emit<E extends EventName<MapContextEvents>>(event: E, ...args: MapContextEvents[E]): void;
}

export function createEventBus(): EventBus {
	const bus = new Vue();

	return {
		$on: (...args) => { bus.$on(...args); },
		$once: (...args) => { bus.$once(...args); },
		$off: (...args) => { bus.$off(...args); },
		$emit: (...args) => { bus.$emit(...args); },
	};
}