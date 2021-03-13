import WithRender from "./line-info-tab.vue";
import Vue from "vue";
import { Component, Watch } from "vue-property-decorator";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { ID, Line } from "facilmap-types";
import Client from "facilmap-client";
import LineInfo from "./line-info";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";

@WithRender
@Component({
	components: { LineInfo }
})
export default class LineInfoTab extends Vue {

	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	mounted(): void {
		this.$root.$on("fm-open-selection", this.handleOpenSelection);
	}

	beforeDestroy(): void {
		this.$root.$off("fm-open-selection", this.handleOpenSelection);
	}

	get lineId(): ID | undefined {
		if (this.mapContext.selection.length == 1 && this.mapContext.selection[0].type == "line")
			return this.mapContext.selection[0].id;
		else
			return undefined;
	}

	get line(): Line | undefined {
		return this.lineId != null ? this.client.lines[this.lineId] : undefined;
	}

	@Watch("line")
	handleChangeLine(line: Line | undefined): void {
		if (!line && this.lineId != null)
			this.mapComponents.selectionHandler.setSelectedItems([]);
	}

	get title(): string | undefined {
		if (this.line != null)
			return this.line.name;
		else
			return undefined;
	}

	handleOpenSelection(): void {
		if (this.line)
			this.$root.$emit("fm-search-box-show-tab", "fm-line-info-tab")
	}

}