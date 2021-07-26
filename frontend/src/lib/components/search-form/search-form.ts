import WithRender from "./search-form.vue";
import "./search-form.scss";
import Vue from "vue";
import { Component, Ref, Watch } from "vue-property-decorator";
import Icon from "../ui/icon/icon";
import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { isSearchId } from "facilmap-utils";
import { showErrorToast } from "../../utils/toasts";
import { FindOnMapResult, SearchResult } from "facilmap-types";
import SearchResults from "../search-results/search-results";
import { flyTo, getZoomDestinationForMapResult, getZoomDestinationForResults, getZoomDestinationForSearchResult, normalizeZoomDestination, openSpecialQuery, ZoomDestination } from "../../utils/zoom";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { Util } from "leaflet";
import { isMapResult } from "../../utils/search";
import storage from "../../utils/storage";
import { HashQuery } from "facilmap-leaflet";
import { FileResultObject, parseFiles } from "../../utils/files";
import FileResults from "../file-results/file-results";
import { Context } from "../facilmap/facilmap";

@WithRender
@Component({
	components: { Icon, FileResults, SearchResults }
})
export default class SearchForm extends Vue {

	@InjectContext() context!: Context;
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;

	@Ref() searchInput!: HTMLInputElement;

	autofocus = false;
	searchString = "";
	loadingSearchString = "";
	loadedSearchString = "";
	searchCounter = 0;
	layerId: number = null as any;

	searchResults: SearchResult[] | null = null;
	mapResults: FindOnMapResult[] | null = null;
	fileResult: FileResultObject | null = null;

	created(): void {
		this.autofocus = !this.context.isNarrow && this.context.autofocus
	}

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

	get zoomDestination(): ZoomDestination | undefined {
		return getZoomDestinationForResults([
			...(this.searchResults || []),
			...(this.mapResults || []),
			...(this.fileResult?.features || [])
		]);
	}

	get hashQuery(): HashQuery | undefined {
		if (this.loadedSearchString) {
			return {
				query: this.loadedSearchString,
				...(this.zoomDestination && normalizeZoomDestination(this.mapComponents.map, this.zoomDestination)),
				description: `Search for ${this.loadedSearchString}`
			};
		} else if (this.loadingSearchString)
			return { query: this.loadingSearchString, description: `Search for ${this.loadedSearchString}` };
		else
			return undefined;
	}

	@Watch("hashQuery")
	handleHashQueryChange(hashQuery: HashQuery | undefined): void {
		this.$emit("hash-query-change", hashQuery);
	}

	setSearchString(searchString: string): void {
		this.searchString = searchString;
	}

	handleSubmit(): void {
		this.searchInput.blur();

		this.search(this.autoZoom, this.zoomToAll);
	}

	async search(zoom: boolean, zoomToAll?: boolean, smooth = true): Promise<void> {
		if (this.searchString != this.loadedSearchString) {
			this.reset();

			const counter = ++this.searchCounter;

			if(this.searchString.trim() != "") {
				try {
					if (await openSpecialQuery(this.searchString, this.context, this.client, this.mapComponents, this.mapContext, zoom)) {
						this.searchString = "";
						return;
					}

					const query = this.searchString;
					this.loadingSearchString = this.searchString;

					const [searchResults, mapResults] = await Promise.all([
						this.client.find({ query, loadUrls: true, elevation: true }),
						this.client.padData ? this.client.findOnMap({ query }) : undefined
					]);

					if (counter != this.searchCounter)
						return; // Another search has been started in the meantime

					this.loadingSearchString = "";
					this.loadedSearchString = query;

					if(isSearchId(query) && Array.isArray(searchResults) && searchResults.length > 0 && searchResults[0].display_name) {
						this.searchString = searchResults[0].display_name;
						this.loadedSearchString = query;
					}

					if(typeof searchResults == "string") {
						this.searchResults = null;
						this.mapResults = null;
						this.fileResult = parseFiles([ searchResults ]);
						this.mapComponents.searchResultsLayer.setResults(this.fileResult.features);
					} else {
						this.searchResults = searchResults;
						this.mapComponents.searchResultsLayer.setResults(searchResults);
						this.mapResults = mapResults ?? null;
						this.fileResult = null;
					}
				} catch(err) {
					showErrorToast(this, `fm${this.context.id}-search-form-error`, "Search error", err);
					return;
				}
			}
		}

		if (zoomToAll || (zoomToAll == null && (this.searchResults?.length ?? 0) + (this.mapResults?.length ?? 0) > 1)) {
			if (zoom)
				this.zoomToAllResults(smooth);
		} else if (this.mapResults && this.mapResults.length > 0 && (this.mapResults[0].similarity == 1 || (!this.searchResults || this.searchResults.length == 0))) {
			this.mapComponents.selectionHandler.setSelectedItems([{ type: this.mapResults[0].kind, id: this.mapResults[0].id }])
			if (zoom)
				this.zoomToResult(this.mapResults[0], smooth);
		} else if (this.searchResults && this.searchResults.length > 0) {
			this.mapComponents.selectionHandler.setSelectedItems([{ type: "searchResult", result: this.searchResults[0], layerId: this.layerId }]);
			if (zoom)
				this.zoomToResult(this.searchResults[0], smooth);
		} else if (this.fileResult) {
			if (zoom)
				this.zoomToAllResults(smooth);
		}
	}

	reset(): void {
		this.searchCounter++;

		this.mapComponents.selectionHandler.setSelectedItems(this.mapContext.selection.filter((item) => item.type != "searchResult" || item.layerId != this.layerId));
		this.$bvToast.hide(`fm${this.context.id}-search-form-error`);
		this.loadingSearchString = "";
		this.loadedSearchString = "";
		this.searchResults = null;
		this.mapResults = null;
		this.fileResult = null;
		this.mapComponents.searchResultsLayer.setResults([]);
	};

	zoomToResult(result: SearchResult | FindOnMapResult, smooth = true): void {
		const dest = isMapResult(result) ? getZoomDestinationForMapResult(result) : getZoomDestinationForSearchResult(result);
		if (dest)
			flyTo(this.mapComponents.map, dest, smooth);
	}

	zoomToAllResults(smooth = true): void {
		if (this.zoomDestination)
			flyTo(this.mapComponents.map, this.zoomDestination, smooth);
	}

}