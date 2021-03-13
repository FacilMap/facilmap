import WithRender from "./search-results.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { FindOnMapResult, SearchResult } from "facilmap-types";
import "./search-results.scss";
import Icon from "../ui/icon/icon";
import Client from "facilmap-client";
import { InjectClient } from "../client/client";
import context from "../context";

@WithRender
@Component({
	components: { Icon }
})
export default class SearchResults extends Vue {
	
	@InjectClient() client!: Client;

	@Prop({ type: Array }) searchResults?: SearchResult[];
	@Prop({ type: Array }) mapResults?: FindOnMapResult[];
	@Prop({ type: Array, default: [] }) activeResults!: Array<SearchResult | FindOnMapResult>;
	@Prop({ type: Boolean, default: false }) showZoom!: boolean;

	get isNarrow(): boolean {
		return context.isNarrow;
	}

}