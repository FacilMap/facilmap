import WithRender from "./line-info.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ExportFormat, ID, Line } from "facilmap-types";
import { IdType } from "../../utils/utils";
import Client from "facilmap-client";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { showErrorToast } from "../../utils/toasts";
import EditLine from "../edit-line/edit-line";
import ElevationStats from "../ui/elevation-stats/elevation-stats";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import ElevationPlot from "../ui/elevation-plot/elevation-plot";
import Icon from "../ui/icon/icon";
import "./line-info.scss";
import { flyTo, getZoomDestinationForLine } from "../../utils/zoom";

@WithRender
@Component({
	components: { EditLine, ElevationPlot, ElevationStats, Icon }
})
export default class LineInfo extends Vue {
	
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: IdType, required: true }) lineId!: ID;

	isSaving = false;
	showElevationPlot = false;

	get line(): Line | undefined {
		return this.client.lines[this.lineId];
	}

	async deleteLine(): Promise<void> {
		this.$bvToast.hide("fm-line-info-delete");

		if (!this.line || !await this.$bvModal.msgBoxConfirm(`Do you really want to remove the line “${this.line.name}”?`))
			return;
		
		this.isSaving = true;
		try {
			await this.client.deleteLine({ id: this.lineId });
		} catch (err) {
			showErrorToast(this, "fm-line-info-delete", "Error deleting line", err);
		} finally {
			this.isSaving = false;
		}
	}

	zoomToLine(): void {
		if (this.line)
			flyTo(this.mapComponents.map, getZoomDestinationForLine(this.line));
	}

	async exportRoute(format: ExportFormat): Promise<void> {
		if (!this.line)
			return;

		this.$bvToast.hide("fm-line-info-export-error");

		try {
			const exported = await this.client.exportLine({ id: this.line.id, format });
			saveAs(new Blob([exported], { type: "application/gpx+xml" }), `${this.line.name}.gpx`);
		} catch(err) {
			showErrorToast(this, "fm-line-info-export-error", "Error exporting line", err);
		}
	}

}