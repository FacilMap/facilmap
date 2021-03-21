import WithRender from "./search-form-tab.vue";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import SearchForm from "./search-form";
import "./search-form-tab.scss";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { Util } from "leaflet";

@WithRender
@Component({
	components: { SearchForm }
})
export default class SearchFormTab extends Vue {

	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	mounted(): void {
		this.mapContext.$on("fm-open-selection", this.handleOpenSelection);
	}

	beforeDestroy(): void {
		this.mapContext.$off("fm-open-selection", this.handleOpenSelection);
	}

	handleOpenSelection(): void {
		const layerId = Util.stamp(this.mapComponents.searchResultsLayer);
		if (this.mapContext.selection.some((item) => item.type == "searchResult" && item.layerId == layerId))
			this.mapContext.$emit("fm-search-box-show-tab", "fm-search-form-tab");
	}

}