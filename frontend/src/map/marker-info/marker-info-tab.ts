import WithRender from "./marker-info-tab.vue";
import Vue from "vue";
import { Component, Watch } from "vue-property-decorator";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { ID, Marker } from "facilmap-types";
import Client from "facilmap-client";
import MarkerInfo from "./marker-info";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";

@WithRender
@Component({
	components: { MarkerInfo }
})
export default class MarkerInfoTab extends Vue {

	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	mounted(): void {
		this.$root.$on("fm-open-selection", this.handleOpenSelection);
	}

	beforeDestroy(): void {
		this.$root.$off("fm-open-selection", this.handleOpenSelection);
	}

	get markerId(): ID | undefined {
		if (this.mapContext.selection.length == 1 && this.mapContext.selection[0].type == "marker")
			return this.mapContext.selection[0].id;
		else
			return undefined;
	}

	get marker(): Marker | undefined {
		return this.markerId != null ? this.client.markers[this.markerId] : undefined;
	}

	@Watch("marker")
	handleChangeMarker(marker: Marker | undefined): void {
		if (!marker && this.markerId != null)
			this.mapComponents.selectionHandler.setSelectedItems([]);
	}

	handleOpenSelection(): void {
		if (this.marker)
			this.$root.$emit("fm-search-box-show-tab", "fm-marker-info-tab");
	}

	get title(): string | undefined {
		if (this.marker != null)
			return this.marker.name;
		else
			return undefined;
	}

}