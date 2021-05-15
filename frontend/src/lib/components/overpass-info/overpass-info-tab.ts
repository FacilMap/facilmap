import WithRender from "./overpass-info-tab.vue";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import Icon from "../ui/icon/icon";
import { Context } from "../facilmap/facilmap";
import { OverpassElement } from "facilmap-leaflet";
import OverpassMultipleInfo from "./overpass-multiple-info";

@WithRender
@Component({
	components: { Icon, OverpassMultipleInfo }
})
export default class OverpassInfoTab extends Vue {

	@InjectContext() context!: Context;
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	mounted(): void {
		this.mapContext.$on("fm-open-selection", this.handleOpenSelection);
	}

	beforeDestroy(): void {
		this.mapContext.$off("fm-open-selection", this.handleOpenSelection);
	}

	get elements(): OverpassElement[] {
		return this.mapContext.selection.flatMap((item) => (item.type == "overpass" ? [item.element] : []));
	}

	handleOpenSelection(): void {
		if (this.elements.length > 0)
			this.mapContext.$emit("fm-search-box-show-tab", `fm${this.context.id}-overpass-info-tab`);
	}

	handleElementClick(element: OverpassElement, event: MouseEvent): void {
		if (event.ctrlKey)
			this.mapComponents.selectionHandler.setSelectedItems(this.mapContext.selection.filter((it) => it.type != "overpass" || it.element !== element), true);
		else
			this.mapComponents.selectionHandler.setSelectedItems(this.mapContext.selection.filter((it) => it.type == "overpass" && it.element === element), true);
	}

	close(): void {
		this.mapComponents.selectionHandler.setSelectedItems([]);
	}

}