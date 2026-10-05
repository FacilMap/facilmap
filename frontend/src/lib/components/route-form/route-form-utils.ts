import { type DeepReadonly } from "vue";
import { formatCoordinates } from "facilmap-utils";
import type { FindOnMapResult, SearchResult } from "facilmap-types";
import { Icon, latLng, type LatLng } from "leaflet";
import { isMapResult } from "../../utils/search.js";
import { UseAsType, type RouteDestination } from "../facil-map-context-provider/route-form-tab-context.js";
import type { RouteWithTrackPoints } from "facilmap-client";
import { getMarkerIcon } from "facilmap-leaflet";

export const startMarkerColour = "00ff00";
export const dragMarkerColour = "ffd700";
export const endMarkerColour = "ff0000";

export type RouteFormSearchSuggestion = SearchResult;
export type RouteFormMapSuggestion = FindOnMapResult & { kind: "marker" };
export type RouteFormSuggestion = RouteFormSearchSuggestion | RouteFormMapSuggestion;

export interface RouteFormDestination extends RouteDestination {
	query: string;
	loadingQuery?: string;
	loadingPromise?: Promise<void>;
	loadedQuery?: string;
	searchSuggestions?: DeepReadonly<RouteFormSearchSuggestion[]>;
	mapSuggestions?: DeepReadonly<RouteFormMapSuggestion[]>;
	selectedSuggestion?: DeepReadonly<RouteFormSuggestion>;
}

export type RouteFormDestinationResults = {
};

export function makeCoordDestination(latlng: LatLng): RouteFormDestination {
	const disp = formatCoordinates({ lat: latlng.lat, lon: latlng.lng });
	let suggestion = {
		lat: latlng.lat,
		lon: latlng.lng,
		display_name: disp,
		short_name: disp,
		type: "coordinates",
		id: disp
	};
	return {
		query: disp,
		loadingQuery: disp,
		loadedQuery: disp,
		selectedSuggestion: suggestion,
		searchSuggestions: [ suggestion ]
	};
}

export function makeDestination({ query, searchSuggestions, mapSuggestions, selectedSuggestion }: DeepReadonly<{ query: string; searchSuggestions?: SearchResult[]; mapSuggestions?: FindOnMapResult[]; selectedSuggestion?: SearchResult | FindOnMapResult }>): RouteFormDestination {
	return {
		query,
		loadedQuery: searchSuggestions || mapSuggestions ? query : undefined,
		searchSuggestions,
		mapSuggestions: mapSuggestions?.filter((result) => result.kind == "marker") as RouteFormMapSuggestion[],
		selectedSuggestion: selectedSuggestion as RouteFormMapSuggestion
	};
}

export function getInitialDestinations(route: RouteWithTrackPoints | undefined): RouteFormDestination[] {
	if (route) {
		return route.routePoints.map((point) => makeCoordDestination(latLng(point.lat, point.lon)));
	} else {
		return [{ query: "" }, { query: "" }];
	}
}

export function useDestinationAs(destinations: RouteFormDestination[], data: Parameters<typeof makeDestination>[0], as: UseAsType): { destinations: RouteFormDestination[]; idx: number } {
	const dest = makeDestination(data);

	switch (as) {
		case UseAsType.BEFORE_FROM:
			return {
				destinations: [dest, ...destinations],
				idx: 0
			};

		case UseAsType.AS_FROM:
			return {
				destinations: replaceDestination(destinations, dest, 0),
				idx: 0
			};

		case UseAsType.AFTER_FROM:
			return {
				destinations: insertDestination(destinations, dest, 1),
				idx: 1
			};

		case UseAsType.BEFORE_TO:
			return {
				destinations: insertDestination(destinations, dest, destinations.length - 1),
				idx: destinations.length - 1
			};

		case UseAsType.AS_TO:
			return {
				destinations: replaceDestination(destinations, dest, destinations.length - 1),
				idx: destinations.length - 1
			};

		case UseAsType.AFTER_TO:
			return {
				destinations: [...destinations, dest],
				idx: destinations.length - 1
			};
	}
}

export function insertDestination(destinations: DeepReadonly<RouteFormDestination[]>, destination: RouteFormDestination, idx: number): RouteFormDestination[] {
	return [
		...destinations.slice(0, idx),
		destination,
		...destinations.slice(idx)
	];
}

export function replaceDestination(destinations: DeepReadonly<RouteFormDestination[]>, destination: RouteFormDestination, idx: number): RouteFormDestination[] {
	return [
		...destinations.slice(0, idx),
		destination,
		...destinations.slice(idx + 1)
	];
}

export function removeDestination(destinations: DeepReadonly<RouteFormDestination[]>, idx: number): RouteFormDestination[] {
	return [
		...destinations.slice(0, idx),
		...destinations.slice(idx + 1)
	];
}

export function getSelectedSuggestion(dest: RouteFormDestination): DeepReadonly<RouteFormSuggestion> | undefined {
	if(dest.selectedSuggestion && [...(dest.searchSuggestions || []), ...(dest.mapSuggestions || [])].includes(dest.selectedSuggestion))
		return dest.selectedSuggestion;
	else if(dest.mapSuggestions && dest.mapSuggestions.length > 0 && (dest.mapSuggestions[0].similarity == 1 || (dest.searchSuggestions || []).length == 0))
		return dest.mapSuggestions[0];
	else if((dest.searchSuggestions || []).length > 0)
		return dest.searchSuggestions![0];
	else
		return undefined;
}

export function getSelectedSuggestionId(dest: RouteFormDestination): string | undefined {
	const sugg = getSelectedSuggestion(dest);
	if (!sugg)
		return undefined;

	if (isMapResult(sugg))
		return (sugg.kind == "marker" ? "m" : "l") + sugg.id;
	else
		return sugg.id;
}

export function getSelectedSuggestionName(dest: RouteFormDestination): string | undefined {
	const sugg = getSelectedSuggestion(dest);
	if (!sugg)
		return undefined;

	if (isMapResult(sugg))
		return sugg.name;
	else
		return sugg.short_name;
}

export function getRouteDragIcon(i: number, length: number, highlight = false): Icon {
	return getMarkerIcon(i == 0 ? `#${startMarkerColour}` : i == length - 1 ? `#${endMarkerColour}` : `#${dragMarkerColour}`, 35, undefined, undefined, highlight);
}