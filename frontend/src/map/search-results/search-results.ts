import WithRender from "./search-results.vue";
import Vue from "vue";
import { Component, Prop, Watch } from "vue-property-decorator";
import { FindOnMapResult, LineCreate, MarkerCreate, SearchResult, Type } from "facilmap-types";
import "./search-results.scss";
import Icon from "../ui/icon/icon";
import Client from "facilmap-client";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import context from "../context";
import SearchResultInfo from "../search-result-info/search-result-info";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { SelectedItem } from "../../utils/selection";
import { Point } from "geojson";
import { FileResult } from "../../utils/files";
import { showErrorToast } from "../../utils/toasts";
import { lineStringToTrackPoints, mapSearchResultToType } from "./utils";
import { isFileResult, isSearchResult } from "../../utils/search";

@WithRender
@Component({
	components: { Icon, SearchResultInfo }
})
export default class SearchResults extends Vue {
	
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: Array }) searchResults?: Array<SearchResult | FileResult>;
	@Prop({ type: Array }) mapResults?: FindOnMapResult[];
	@Prop({ type: Boolean, default: false }) showZoom!: boolean;
	@Prop({ type: Number, required: true }) layerId!: number;

	activeTab = 0;

	get isNarrow(): boolean {
		return context.isNarrow;
	}

	get openResult(): SearchResult | undefined {
		if (this.activeResults.length == 1 && !("kind" in this.activeResults[0]))
			return this.activeResults[0];
		else
			return undefined;
	}

	get activeResults(): Array<SearchResult | FindOnMapResult> {
		return [
			...(this.searchResults || []).filter((result) => this.mapContext.selection.some((item) => item.type == "searchResult" && item.result === result)),
			...(this.mapResults || []).filter((result) => {
				if (result.kind == "marker")
					return this.mapContext.selection.some((item) => item.type == "marker" && item.id == result.id);
				else if (result.kind == "line")
					return this.mapContext.selection.some((item) => item.type == "line" && item.id == result.id);
				else
					return false;
			})
		];
	}

	closeResult(): void {
		this.activeTab = 0;
	}

	@Watch("openResult")
	handleOpenResultChange(openResult: SearchResult | undefined): void {
		if (!openResult && this.activeTab != 0)
			this.activeTab = 0;
	}

	handleClick(result: SearchResult | FindOnMapResult, event: MouseEvent): void {
		this.selectResult(result, event.ctrlKey || event.shiftKey);
		this.$emit('click-result', result);
	}

	handleZoom(result: SearchResult | FindOnMapResult, event: MouseEvent): void {
		this.$emit('zoom-result', result);
	}

	handleOpen(result: SearchResult | FindOnMapResult, event: MouseEvent): void {
		this.selectResult(result, false);

		setTimeout(async () => {
			if ("kind" in result) {
				if (result.kind == "marker" && !this.client.markers[result.id])
					await this.client.getMarker({ id: result.id });
				this.mapContext.$emit("fm-search-box-show-tab", "fm-marker-info-tab", false);
			} else
				this.activeTab = 1;
		}, 0);
	}

	selectResult(result: SearchResult | FindOnMapResult, toggle: boolean): void {
		const item: SelectedItem = "kind" in result ? { type: result.kind, id: result.id } : { type: "searchResult", result, layerId: this.layerId };
		if (toggle)
			this.mapComponents.selectionHandler.toggleItem(item);
		else
			this.mapComponents.selectionHandler.setSelectedItems([item]);
	}

	async addToMap(results: Array<SearchResult | FileResult>, type: Type): Promise<void> {
		this.$bvToast.hide("fm-search-result-info-add-error");

		try {
			for (const result of results) {
				const obj: Partial<MarkerCreate & LineCreate> = {
					name: result.short_name
				};

				if("fmProperties" in result && result.fmProperties) { // Import GeoJSON
					Object.assign(obj, result.fmProperties);
					delete obj.typeId;
				} else {
					obj.data = mapSearchResultToType(result, type)
				}

				if(type.type == "marker") {
					const marker = await this.client.addMarker({
						...obj,
						lat: result.lat ?? (result.geojson as Point).coordinates[1],
						lon: result.lon ?? (result.geojson as Point).coordinates[0],
						typeId: type.id
					});

					this.mapComponents.selectionHandler.setSelectedItems([{ type: "marker", id: marker.id }], true);
				} else if(type.type == "line") {
					if (obj.routePoints) {
						const line = await this.client.addLine({
							...obj,
							routePoints: obj.routePoints,
							typeId: type.id
						});

						this.mapComponents.selectionHandler.setSelectedItems([{ type: "line", id: line.id }], true);
					} else {
						const trackPoints = lineStringToTrackPoints(result.geojson as any);
						const line = await this.client.addLine({
							...obj,
							typeId: type.id,
							routePoints: [trackPoints[0], trackPoints[trackPoints.length-1]],
							trackPoints: trackPoints,
							mode: "track"
						});

						this.mapComponents.selectionHandler.setSelectedItems([{ type: "line", id: line.id }], true);
					}
				}
			}
		} catch (err) {
			showErrorToast(this, "fm-search-result-info-add-error", "Error adding to map", err);
		}
	}

	useAs(result: SearchResult | FileResult, event: "fm-route-set-from" | "fm-route-add-via" | "fm-route-set-to"): void {
		if (isFileResult(result))
			this.mapContext.$emit(event, `${result.lat},${result.lon}`);
		else
			this.mapContext.$emit(event, result.short_name, this.searchResults, this.mapResults, result);
		this.mapContext.$emit("fm-search-box-show-tab", "fm-route-form-tab");
	}

	useAsFrom(result: SearchResult | FileResult): void {
		this.useAs(result, "fm-route-set-from");
	}

	useAsVia(result: SearchResult | FileResult): void {
		this.useAs(result, "fm-route-add-via");
	}

	useAsTo(result: SearchResult | FileResult): void {
		this.useAs(result, "fm-route-set-to");
	}

}