import WithRender from "./search-results.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { FindOnMapResult, SearchResult } from "facilmap-types";
import "./search-results.scss";
import Icon from "../ui/icon/icon";
import Client from "facilmap-client";
import { InjectClient } from "../../utils/decorators";
import context from "../context";
import SearchResultInfo from "../search-result-info/search-result-info";

@WithRender
@Component({
	components: { Icon, SearchResultInfo }
})
export default class SearchResults extends Vue {
	
	@InjectClient() client!: Client;

	@Prop({ type: Array }) searchResults?: SearchResult[];
	@Prop({ type: Array }) mapResults?: FindOnMapResult[];
	@Prop({ type: Array, default: [] }) activeResults!: Array<SearchResult | FindOnMapResult>;
	@Prop({ type: Boolean, default: false }) showZoom!: boolean;

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

	closeResult(): void {
		this.activeTab = 0;
	}

	handleClick(result: SearchResult | FindOnMapResult, event: MouseEvent): void {
		this.$emit('click-result', result, event);
	}

	handleZoom(result: SearchResult | FindOnMapResult, event: MouseEvent): void {
		this.$emit('zoom-result', result, event);
	}

	handleOpen(result: SearchResult | FindOnMapResult, event: MouseEvent): void {
		this.$emit('select-result', result, event);

		setTimeout(() => {
			if ("kind" in result)
				this.$root.$emit("fm-search-box-show-tab", "fm-marker-info-tab", false);
			else
				this.activeTab = 1;
		}, 0);
	}

}