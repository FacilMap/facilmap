import WithRender from "./route-form.vue";
import "./route-form.scss";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Icon from "../ui/icon/icon";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { isSearchId, round } from "facilmap-utils";
import Client from "facilmap-client";
import { showErrorToast } from "../../utils/toasts";
import { FindOnMapResult, SearchResult } from "facilmap-types";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { getMarkerIcon, MarkerLayer, RouteLayer } from "facilmap-leaflet";
import { getZoomDestinationForRoute, flyTo } from "../../utils/zoom";
import { LatLng } from "leaflet";
import draggable from "vuedraggable";
import RouteMode from "../ui/route-mode/route-mode";
import DraggableLines from "leaflet-draggable-lines";
import { throttle } from "lodash";

type SearchSuggestion = SearchResult;
type MapSuggestion = FindOnMapResult & { kind: "marker" };
type Suggestion = SearchSuggestion | MapSuggestion;

interface Destination {
	query: string;
	loadingQuery?: string;
	loadedQuery?: string;
	searchSuggestions?: SearchSuggestion[];
	mapSuggestions?: MapSuggestion[];
	selectedSuggestion?: Suggestion;
}

function makeCoordDestination(latlng: LatLng) {
	const disp = round(latlng.lat, 5) + "," + round(latlng.lng, 5);
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

/* function _setDestination(dest, query, searchSuggestions, mapSuggestions, selectedSuggestion) {
	dest.query = query;

	if(searchSuggestions) {
		dest.searchSuggestions = searchSuggestions;
		dest.mapSuggestions = mapSuggestions && mapSuggestions.filter((suggestion) => (suggestion.kind == "marker"));
		dest.loadingQuery = dest.loadedQuery = query;
		dest.selectedSuggestion = selectedSuggestion;
	}
} */

const startMarkerColour = "00ff00";
const dragMarkerColour = "ffd700";
const endMarkerColour = "ff0000";

function getIcon(i: number, length: number, highlight = false) {
	return getMarkerIcon(i == 0 ? startMarkerColour : i == length - 1 ? endMarkerColour : dragMarkerColour, 35, undefined, undefined, highlight);
}

@WithRender
@Component({
	components: { draggable, Icon, RouteMode }
})
export default class RouteForm extends Vue {
	
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;

	routeLayer!: RouteLayer;
	draggable!: DraggableLines;

	routeMode = 'car';
	destinations: Destination[] = [
		{ query: "" },
		{ query: "" }
	];
	submittedQueries = null;
	submittedMode = null;
	routeError: string | null = null;
	hoverDestinationIdx: number | null = null;
	hoverInsertIdx: number | null = null;

	// Do not make reactive
	suggestionMarker: MarkerLayer | undefined;

	mounted(): void {
		this.routeLayer = new RouteLayer(this.client, { weight: 7 }).addTo(this.mapComponents.map);
		this.draggable = new DraggableLines(this.mapComponents.map, {
			enableForLayer: this.routeLayer,
			tempMarkerOptions: () => ({
				icon: getMarkerIcon(dragMarkerColour, 35),
				pane: "fm-raised-marker"
			}),
			plusTempMarkerOptions: () => ({
				icon: getMarkerIcon(dragMarkerColour, 35),
				pane: "fm-raised-marker"
			}),
			dragMarkerOptions: (layer, i, length) => ({
				icon: getIcon(i, length),
				pane: "fm-raised-marker"
			})
		}).enable();
		this.draggable.on({
			insert: (e: any) => {
				this.destinations.splice(e.idx, 0, makeCoordDestination(e.latlng));
				this.reroute(false);
			},
			dragstart: (e: any) => {
				this.hoverDestinationIdx = e.idx;
				this.hoverInsertIdx = null;
				if (e.isNew)
					this.destinations.splice(e.idx, 0, makeCoordDestination(e.to));
			},
			drag: throttle((e: any) => {
				Vue.set(this.destinations, e.idx, makeCoordDestination(e.to));
			}, 300),
			dragend: (e: any) => {
				Vue.set(this.destinations, e.idx, makeCoordDestination(e.to));
				this.reroute(false);
			},
			remove: (e: any) => {
				this.hoverDestinationIdx = null;
				this.destinations.splice(e.idx, 1);
				this.reroute(false);
			},
			dragmouseover: (e: any) => {
				this.destinationMouseOver(e.idx);
			},
			dragmouseout: (e: any) => {
				this.destinationMouseOut(e.idx);
			},
			plusmouseover: (e: any) => {
				this.hoverInsertIdx = e.idx;
			},
			plusmouseout: (e: any) => {
				this.hoverInsertIdx = null;
			},
			tempmouseover: (e: any) => {
				this.hoverInsertIdx = e.idx;
			},
			tempmousemove: (e: any) => {
				if (e.idx != this.hoverInsertIdx)
					this.hoverInsertIdx = e.idx;
			},
			tempmouseout: (e: any) => {
				this.hoverInsertIdx = null;
			}
		} as any);

		/* if(scope.submittedQueries)
			scope.submittedQueries.splice(idx, 0, makeCoordDestination(point).query);
		map.mapEvents.$broadcast("searchchange"); */
	}

	beforeDestroy(): void {
		this.draggable.disable();
		this.routeLayer.remove();
	}

	get hasRoute(): boolean {
		return !!this.client.route;
	}

	addDestination(): void {
		this.destinations.push({
			query: ""
		});
	}

	removeDestination(idx: number): void {
		if (this.destinations.length > 2)
			this.destinations.splice(idx, 1);
	}

	getSelectedSuggestion(dest: Destination): Suggestion | undefined {
		if(dest.selectedSuggestion && [...(dest.searchSuggestions || []), ...(dest.mapSuggestions || [])].includes(dest.selectedSuggestion))
			return dest.selectedSuggestion;
		else if(dest.mapSuggestions && dest.mapSuggestions.length > 0 && (dest.mapSuggestions[0].similarity == 1 || (dest.searchSuggestions || []).length == 0))
			return dest.mapSuggestions[0];
		else if((dest.searchSuggestions || []).length > 0)
			return dest.searchSuggestions![0];
		else
			return undefined;
	}

	async loadSuggestions(dest: Destination): Promise<void> {
		if (dest.loadingQuery == dest.query.trim() || dest.loadedQuery == dest.query.trim())
			return;

		const idx = this.destinations.indexOf(dest);
		this.$bvToast.hide(`fm-route-form-suggestion-error-${idx}`);
		Vue.set(dest, "searchSuggestions", undefined);
		Vue.set(dest, "mapSuggestions", undefined);
		Vue.set(dest, "selectedSuggestion", undefined);
		Vue.set(dest, "loadingQuery", undefined);
		Vue.set(dest, "loadedQuery", undefined);

		const query = dest.query.trim();

		if(query != "") {
			dest.loadingQuery = query;

			try {
				const [searchResults, mapResults] = await Promise.all([
					this.client.find({ query: query }),
					(async () => {
						if (this.client.padId) {
							const m = query.match(/^m(\d+)$/);
							if (m) {
								const marker = await this.client.getMarker({ id: Number(m[1]) });
								return marker ? [{ kind: "marker" as const, similarity: 1, ...marker }] : [];
							} else
								return (await this.client.findOnMap({ query })).filter((res) => res.kind == "marker") as MapSuggestion[];
						}
					})()
				])

				if(query != dest.loadingQuery)
					return; // The destination has changed in the meantime

				Vue.set(dest, "loadingQuery", undefined);
				Vue.set(dest, "loadedQuery", query);
				Vue.set(dest, "searchSuggestions", searchResults);
				Vue.set(dest, "mapSuggestions", mapResults);

				if(isSearchId(query) && searchResults.length > 0 && searchResults[0].display_name) {
					if (dest.query == query)
						Vue.set(dest, "query", searchResults[0].display_name);
					Vue.set(dest, "loadedQuery", searchResults[0].display_name);
					Vue.set(dest, "selectedSuggestion", searchResults[0]);
				}

				if(mapResults) {
					const referencedMapResult = mapResults.find((res) => query == `m${res.id}`);
					if(referencedMapResult) {
						if (dest.query == query)
							Vue.set(dest, "query", referencedMapResult.name);
						Vue.set(dest, "loadedQuery", referencedMapResult.name);
						Vue.set(dest, "selectedSuggestion", referencedMapResult);
					}
				}

				if(dest.selectedSuggestion == null)
					Vue.set(dest, "selectedSuggestion", this.getSelectedSuggestion(dest));
			} catch (err) {
				if(query != dest.loadingQuery)
					return; // The destination has changed in the meantime

				console.warn(err.stack || err);
				showErrorToast(this, `fm-route-form-suggestion-error-${idx}`, `Error finding destination “${query}”`, err);
			}
		}
	}

	suggestionMouseOver(suggestion: Suggestion): void {
		this.suggestionMarker = (new MarkerLayer([ suggestion.lat!, suggestion.lon! ], {
			highlight: true,
			marker: {
				colour: dragMarkerColour,
				size: 35,
				symbol: (suggestion as any).icon || (suggestion as any).symbol,
				shape: "drop"
			}
		})).addTo(this.mapComponents.map);
	}

	suggestionMouseOut(): void {
		if(this.suggestionMarker) {
			this.suggestionMarker.remove();
			this.suggestionMarker = undefined;
		}
	}

	suggestionZoom(suggestion: Suggestion): void {
		this.mapComponents.map.flyTo([suggestion.lat!, suggestion.lon!]);
	}

	destinationMouseOver(idx: number): void {
		const marker = this.routeLayer._draggableLines?.dragMarkers[idx];
		if (marker) {
			this.hoverDestinationIdx = idx;
			marker.setIcon(getIcon(idx, this.routeLayer._draggableLines!.dragMarkers.length, true));
		}
		/* let destination = scope.destinations[idx];
		if(!destination)
			return;

		let suggestion = scope.getSelectedSuggestion(destination);

		if(destination.query == destination.loadedQuery && suggestion) {
			let marker = map.routeUi.getMarker(idx);
			if(marker && marker.getLatLng().equals([ suggestion.lat, suggestion.lon ])) {
				highlightedMarker = marker;
				scope.highlightedIdx = idx;
				marker.setStyle({ highlight: true });
			}
		}*/
	}

	destinationMouseOut(idx: number): void {
		this.hoverDestinationIdx = null;

		const marker = this.routeLayer._draggableLines?.dragMarkers[idx];
		if (marker)
			marker.setIcon(getIcon(idx, this.routeLayer._draggableLines!.dragMarkers.length));

		/* if(highlightedMarker) {
			highlightedMarker.setStyle({ highlight: false });
			scope.highlightedIdx = null;
			highlightedMarker = null;
		} */
	}

	getValidationState(destination: Destination): boolean | null {
		if (destination.loadedQuery && destination.query == destination.loadedQuery && this.getSelectedSuggestion(destination) == null)
			return false;
		else
			return null;
	}

	async route(zoom = true): Promise<void> {
		this.reset();

		if(this.destinations[0].query.trim() == "" || this.destinations[this.destinations.length-1].query.trim() == "")
			return;

		try {
			const mode = this.routeMode;

			/* this.submittedQueries = this.destinations.map((dest) => {
				if(dest.loadedQuery == dest.query && (dest.searchSuggestions?.length || dest.mapSuggestions?.length))
					return this.getSelectedSuggestion(dest).hashId || this.getSelectedSuggestion(dest).id;
				else
					return dest.query;
			});
			scope.submittedMode = mode;

			map.mapEvents.$broadcast("searchchange"); */

			await Promise.all(this.destinations.map((dest) => this.loadSuggestions(dest)));
			const points = this.destinations.filter((dest) => dest.query.trim() != "").map((dest) => this.getSelectedSuggestion(dest));

			if(points.some((point) => point == null)) {
				this.routeError = "Some destinations could not be found.";
				return;
			}

			/* scope.submittedQueries = points.map(function(point) {
				return point.hashId || point.id;
			});

			map.mapEvents.$broadcast("searchchange"); */

			const route = await this.client.setRoute({
				routePoints: points.map((point) => ({ lat: point!.lat!, lon: point!.lon! })),
				mode
			});
			
			if (route && zoom) {
				flyTo(this.mapComponents.map, getZoomDestinationForRoute(route));
			}
		} catch (err) {
			showErrorToast(this, "fm-route-form-error", "Error calculating route", err);
		}
	}

	reroute(zoom = true): void {
		if(this.hasRoute)
			this.route(zoom);
	}

	reset(): void {
		this.$bvToast.hide("fm-route-form-error");
		this.submittedQueries = null;
		this.submittedMode = null;
		this.routeError = null;

		if(this.suggestionMarker) {
			this.suggestionMarker.remove();
			this.suggestionMarker = undefined;
		}

		this.client.clearRoute();
	}

	/* const routeUi = searchUi.routeUi = {
		setQueries: function(queries) {
			scope.submittedQueries = null;
			scope.submittedMode = null;
			scope.destinations = [ ];

			for(const i=0; i<queries.length; i++) {
				if(scope.destinations.length <= i)
					scope.addDestination();

				$.extend(scope.destinations[i], typeof queries[i] == "object" ? queries[i] : { query: queries[i] });
			}

			while(scope.destinations.length < 2)
				scope.addDestination();
		},

		setFrom: function(from, searchSuggestions, mapSuggestions, selectedSuggestion) {
			_setDestination(scope.destinations[0], from, searchSuggestions, mapSuggestions, selectedSuggestion);
		},

		addVia: function(via, searchSuggestions, mapSuggestions, selectedSuggestion) {
			scope.addDestination();
			const newDest = scope.destinations.pop();
			_setDestination(newDest, via, searchSuggestions, mapSuggestions, selectedSuggestion);
			scope.destinations.splice(scope.destinations.length-1, 0, newDest);
		},

		setTo: function(to, searchSuggestions, mapSuggestions, selectedSuggestion) {
			_setDestination(scope.destinations[scope.destinations.length-1], to, searchSuggestions, mapSuggestions, selectedSuggestion);
		},

		setMode: function(mode) {
			scope.routeMode = mode;
		},

		getQueries: function() {
			return scope.submittedQueries;
		},

		getTypedQueries: function() {
			return scope.destinations.map((destination) => (destination.query));
		},

		getMode: function() {
			return scope.submittedMode;
		},

		submit: function(noZoom) {
			scope.route(noZoom);
		},

		getSubmittedSearch() {
			const queries = routeUi.getQueries();
			if(queries)
				return queries.join(" to ") + " by " + routeUi.getMode();
		},

		isZoomedToSubmittedSearch() {
			let zoomDestination = map.routeUi.getZoomDestination();
			if(zoomDestination)
				return map.map.getZoom() == zoomDestination[1] && fmUtils.pointsEqual(map.map.getCenter(), zoomDestination[0], map.map);
		},

		hasResults() {
			return map.routeUi.routes.length > 0
		}
	}; */
}
