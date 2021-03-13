import WithRender from "./search-form-tab.vue";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { InjectMapContext } from "../../utils/decorators";
import SearchForm from "./search-form";
import "./search-form-tab.scss";
import { MapContext } from "../leaflet-map/leaflet-map";

@WithRender
@Component({
	components: { SearchForm }
})
export default class SearchFormTab extends Vue {

	@InjectMapContext() mapContext!: MapContext;

	mounted(): void {
		this.$root.$on("fm-open-selection", this.handleOpenSelection);
	}

	beforeDestroy(): void {
		this.$root.$off("fm-open-selection", this.handleOpenSelection);
	}

	handleOpenSelection(): void {
		if (this.mapContext.selection.some((item) => item.type == "searchResult"))
			this.$root.$emit("fm-search-box-show-tab", "fm-search-form-tab");
	}

}