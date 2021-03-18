import WithRender from "./route-form-tab.vue";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import RouteForm from "./route-form";
import "./route-form-tab.scss";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";

@WithRender
@Component({
	components: { RouteForm }
})
export default class RouteFormTab extends Vue {

	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	mounted(): void {
		this.$root.$on("fm-open-selection", this.handleOpenSelection);
	}

	beforeDestroy(): void {
		this.$root.$off("fm-open-selection", this.handleOpenSelection);
	}

	handleOpenSelection(): void {
		if (this.mapContext.selection.some((item) => item.type == "route"))
			this.$root.$emit("fm-search-box-show-tab", "fm-route-form-tab");
	}

}