import WithRender from "./multiple-info-tab.vue";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { Client, InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import MultipleInfo from "./multiple-info";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import Icon from "../ui/icon/icon";
import { Line, Marker } from "facilmap-types";
import StringMap from "../../utils/string-map";
import { isLine, isMarker } from "../../utils/utils";

@WithRender
@Component({
	components: { Icon, MultipleInfo }
})
export default class MultipleInfoTab extends Vue {

	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	mounted(): void {
		this.mapContext.$on("fm-open-selection", this.handleOpenSelection);
	}

	beforeDestroy(): void {
		this.mapContext.$off("fm-open-selection", this.handleOpenSelection);
	}

	get objects(): Array<Marker<StringMap> | Line<StringMap>> | undefined {
		const objects = this.mapContext.selection.flatMap((item): Array<Marker<StringMap> | Line<StringMap>> => {
			if (item.type == "marker" && this.client.markers[item.id])
				return [this.client.markers[item.id]];
			else if (item.type == "line" && this.client.lines[item.id])
				return [this.client.lines[item.id]];
			else
				return [];
		});
		return objects.length > 1 ? objects : undefined;
	}

	handleOpenSelection(): void {
		if (this.objects)
			this.mapContext.$emit("fm-search-box-show-tab", "fm-multiple-info-tab");
	}

	get title(): string | undefined {
		return this.objects ? `${this.objects.length} objects` : undefined;
	}

	handleObjectClick(object: Marker<StringMap> | Line<StringMap>, event: MouseEvent): void {
		const item = this.mapContext.selection.find((it) => {
			return (it.type == "marker" && isMarker(object) && it.id == object.id) || (it.type == "line" && isLine(object) && it.id == object.id);
		});
		if (item) {
			if (event.ctrlKey || event.shiftKey)
				this.mapComponents.selectionHandler.setSelectedItems(this.mapContext.selection.filter((it) => it !== item), true);
			else
				this.mapComponents.selectionHandler.setSelectedItems([item], true);
		}
	}

	close(): void {
		this.mapComponents.selectionHandler.setSelectedItems([]);
	}

}