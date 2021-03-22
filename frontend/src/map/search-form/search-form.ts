import WithRender from "./search-form.vue";
import "./search-form.scss";
import Vue from "vue";
import { Component, Ref } from "vue-property-decorator";
import Icon from "../ui/icon/icon";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { decodeLonLatUrl, isSearchId } from "facilmap-utils";
import Client from "facilmap-client";
import { showErrorToast } from "../../utils/toasts";
import { FindOnMapResult, SearchResult } from "facilmap-types";
import SearchResults from "../search-results/search-results";
import context from "../context";
import { flyTo, getZoomDestinationForMapResult, getZoomDestinationForResults, getZoomDestinationForSearchResult } from "../../utils/zoom";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { Util } from "leaflet";
import { isMapResult } from "../../utils/search";
import storage from "../../utils/storage";

@WithRender
@Component({
	components: { Icon, SearchResults }
})
export default class SearchForm extends Vue {
	
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;

	@Ref() searchInput!: HTMLInputElement;

	autofocus = !context.isNarrow && context.autofocus;
	searchString = "";
	loadedSearchString = "";
	searchCounter = 0;
	layerId: number = null as any;

	searchResults: SearchResult[] | null = null;
	mapResults: FindOnMapResult[] | null = null;

	mounted(): void {
		this.layerId = Util.stamp(this.mapComponents.searchResultsLayer);
	}

	get autoZoom(): boolean {
		return storage.autoZoom;
	}
	
	set autoZoom(autoZoom: boolean) {
		storage.autoZoom = autoZoom;
	}

	get zoomToAll(): boolean {
		return storage.zoomToAll;
	}

	set zoomToAll(zoomToAll: boolean) {
		storage.zoomToAll = zoomToAll;
	}

	async search(): Promise<void> {
		this.searchInput.blur();

		if (this.searchString != this.loadedSearchString) {
			this.reset();

			const counter = ++this.searchCounter;

			if(this.searchString.trim() != "") {
				if(this.searchString.match(/ to /i)) {
					this.mapContext.$emit("fm-route-set-query", this.searchString);
					this.mapContext.$emit("fm-search-box-show-tab", "fm-route-form-tab");
					this.searchString = "";
					return;
				}

				const lonlat = decodeLonLatUrl(this.searchString);
				if(lonlat) {
					this.mapComponents.map.flyTo([ lonlat.lat, lonlat.lon ], lonlat.zoom);
					return;
				}

				try {
					const query = this.searchString;

					const [searchResults, mapResults] = await Promise.all([
						this.client.find({ query, loadUrls: true, elevation: true }),
						this.client.padId ? this.client.findOnMap({ query }) : undefined
					]);

					if (counter != this.searchCounter)
						return; // Another search has been started in the meantime

					this.loadedSearchString = query;

					if(isSearchId(query) && Array.isArray(searchResults) && searchResults.length > 0 && searchResults[0].display_name) {
						this.searchString = searchResults[0].display_name;
						this.loadedSearchString = query;
					}
				

					if(typeof searchResults == "string")
						return; // this.searchResults = parseFiles([ searchResults ]);

					this.searchResults = searchResults;
					this.mapComponents.searchResultsLayer.setResults(searchResults);
					this.mapResults = mapResults ?? null;
				} catch(err) {
					showErrorToast(this, "fm-search-form-error", "Search error", err);
					return;
				}
			}
		}

		if (this.autoZoom) {
			if (this.zoomToAll)
				this.zoomToAllResults();
			else if (this.mapResults && this.mapResults.length > 0 && (this.mapResults[0].similarity == 1 || (!this.searchResults || this.searchResults.length == 0))) {
				this.mapComponents.selectionHandler.setSelectedItems([{ type: this.mapResults[0].kind, id: this.mapResults[0].id }])
				this.zoomToResult(this.mapResults[0]);
			}
			else if (this.searchResults && this.searchResults.length > 0) {
				this.mapComponents.selectionHandler.setSelectedItems([{ type: "searchResult", result: this.searchResults[0], layerId: this.layerId }]);
				this.zoomToResult(this.searchResults[0]);
			}
		}
	}

	reset(): void {
		this.searchCounter++;

		this.mapComponents.selectionHandler.setSelectedItems(this.mapContext.selection.filter((item) => item.type != "searchResult" || item.layerId != this.layerId));
		this.$bvToast.hide("fm-search-form-error");
		this.loadedSearchString = "";
		this.searchResults = null;
		this.mapResults = null;
		this.mapComponents.searchResultsLayer.setResults([]);
	};

	zoomToResult(result: SearchResult | FindOnMapResult): void {
		const dest = isMapResult(result) ? getZoomDestinationForMapResult(result) : getZoomDestinationForSearchResult(result);
		if (dest)
			flyTo(this.mapComponents.map, dest);
	}

	zoomToAllResults(): void {
		const dest = getZoomDestinationForResults([
			...(this.searchResults || []),
			...(this.mapResults || [])
		]);
		if (dest)
			flyTo(this.mapComponents.map, dest);
	}

	toggleZoomToAll(): void {
		this.zoomToAll = !this.zoomToAll;

		if (this.autoZoom && this.zoomToAll)
			this.zoomToAllResults();
	}

}

/* TODO
			function getZoomDestination(result, unionZoom) {
				let forBounds = (bounds) => ([
					bounds.getCenter(),
					Math.min(15, map.map.getBoundsZoom(bounds))
				]);

				if(!result) // Zoom to all
					return forBounds(layerGroup.getBounds());
				else if(unionZoom) { // Zoom to item, keep current map bounding box in view
					if(result.boundingbox)
						return forBounds(map.map.getBounds().extend(L.latLngBounds([ [ result.boundingbox[0], result.boundingbox[3 ] ], [ result.boundingbox[1], result.boundingbox[2] ] ])));
					else if(result.layer)
						return forBounds(map.map.getBounds().extend(result.layer.getBounds()));
					else if(result.lat != null && result.lon != null)
						return forBounds(map.map.getBounds().extend(L.latLng(result.lat, result.lon)));
				} else { // Zoom to item
					if(result.lat && result.lon && result.zoom) {
						return [ L.latLng(1*result.lat, 1*result.lon), 1*result.zoom ];
					} else if(result.boundingbox)
						return forBounds(L.latLngBounds([ [ result.boundingbox[0], result.boundingbox[3 ] ], [ result.boundingbox[1], result.boundingbox[2] ] ]));
					else if(result.layer)
						return forBounds(result.layer.getBounds());
				}
			}

				isZoomedToSubmittedSearch: function() {
					if(scope.searchResults && scope.searchResults.features.length > 0) {
						let [center, zoom] = getZoomDestination();
						return map.map.getZoom() == zoom && fmUtils.pointsEqual(map.map.getCenter(), center, map.map);
					}
				},
}); */
