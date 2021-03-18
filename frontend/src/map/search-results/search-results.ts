import WithRender from "./search-results.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { FindOnMapResult, SearchResult } from "facilmap-types";
import "./search-results.scss";
import Icon from "../ui/icon/icon";
import Client from "facilmap-client";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import context from "../context";
import SearchResultInfo from "../search-result-info/search-result-info";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { SelectedItem } from "../../utils/selection";

@WithRender
@Component({
	components: { Icon, SearchResultInfo }
})
export default class SearchResults extends Vue {
	
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: Array }) searchResults?: SearchResult[];
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

	handleClick(result: SearchResult | FindOnMapResult, event: MouseEvent): void {
		this.selectResult(result, event.ctrlKey || event.shiftKey);
		this.$emit('click-result', result);
	}

	handleZoom(result: SearchResult | FindOnMapResult, event: MouseEvent): void {
		this.$emit('zoom-result', result);
	}

	handleOpen(result: SearchResult | FindOnMapResult, event: MouseEvent): void {
		this.selectResult(result, false);

		setTimeout(() => {
			if ("kind" in result)
				this.$root.$emit("fm-search-box-show-tab", "fm-marker-info-tab", false);
			else
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

}