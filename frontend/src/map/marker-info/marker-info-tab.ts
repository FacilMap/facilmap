import WithRender from "./marker-info-tab.vue";
import Vue from "vue";
import { Component, Watch } from "vue-property-decorator";
import { Client, InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { ID, Marker } from "facilmap-types";
import MarkerInfo from "./marker-info";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import Icon from "../ui/icon/icon";
import StringMap from "../../utils/string-map";

@WithRender
@Component({
	components: { Icon, MarkerInfo }
})
export default class MarkerInfoTab extends Vue {

	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	mounted(): void {
		this.mapContext.$on("fm-open-selection", this.handleOpenSelection);
	}

	beforeDestroy(): void {
		this.mapContext.$off("fm-open-selection", this.handleOpenSelection);
	}

	get markerId(): ID | undefined {
		if (this.mapContext.selection.length == 1 && this.mapContext.selection[0].type == "marker")
			return this.mapContext.selection[0].id;
		else
			return undefined;
	}

	get marker(): Marker<StringMap> | undefined {
		return this.markerId != null ? this.client.markers[this.markerId] : undefined;
	}

	@Watch("marker")
	handleChangeMarker(marker: Marker<StringMap> | undefined): void {
		if (!marker && this.markerId != null)
			this.close();
	}

	handleOpenSelection(): void {
		if (this.marker)
			this.mapContext.$emit("fm-search-box-show-tab", "fm-marker-info-tab");
	}

	get title(): string | undefined {
		if (this.marker != null)
			return this.marker.name;
		else
			return undefined;
	}

	close(): void {
		this.mapComponents.selectionHandler.setSelectedItems([]);
	}

}