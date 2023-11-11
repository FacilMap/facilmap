import type { FindOnMapResult, SearchResult } from "facilmap-types";

export interface RouteDestination {
	query: string;
	searchSuggestions?: SearchResult[];
	mapSuggestions?: FindOnMapResult[];
	selectedSuggestion?: SearchResult | FindOnMapResult;
}

export interface WritableRouteFormTabContext {
	setQuery(query: string, zoom?: boolean, smooth?: boolean): void;
	setFrom(destination: RouteDestination): void;
	addVia(destination: RouteDestination): void;
	setTo(destination: RouteDestination): void;
}

export type RouteFormTabContext = Readonly<WritableRouteFormTabContext>;