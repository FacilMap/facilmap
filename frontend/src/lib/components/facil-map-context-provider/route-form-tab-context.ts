import type { FindOnMapResult, SearchResult } from "facilmap-types";
import type { DeepReadonly } from "vue";

export interface RouteDestination {
	query: string;
	searchSuggestions?: DeepReadonly<SearchResult[]>;
	mapSuggestions?: FindOnMapResult[];
	selectedSuggestion?: DeepReadonly<SearchResult | FindOnMapResult>;
}

export enum UseAsType {
	BEFORE_FROM = "before_from",
	AS_FROM = "as_from",
	AFTER_FROM = "after_from",
	BEFORE_TO = "before_to",
	AS_TO = "as_to",
	AFTER_TO = "after_to"
}

export interface WritableRouteFormTabContext {
	setQuery(query: string, zoom?: boolean, smooth?: boolean): void;
	useAs(destination: DeepReadonly<RouteDestination>, as: UseAsType): void;
	hasFrom: boolean;
	hasTo: boolean;
	hasVia: boolean;
}

export type RouteFormTabContext = Readonly<WritableRouteFormTabContext>;