import WithRender from "./line-info.vue";
import Vue from "vue";
import { Component, Prop, Ref } from "vue-property-decorator";
import { ExportFormat, ID, Line } from "facilmap-types";
import { IdType } from "../../utils/utils";
import { Client, InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { showErrorToast, showToast } from "../../utils/toasts";
import EditLine from "../edit-line/edit-line";
import ElevationStats from "../ui/elevation-stats/elevation-stats";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import ElevationPlot from "../ui/elevation-plot/elevation-plot";
import Icon from "../ui/icon/icon";
import "./line-info.scss";
import { flyTo, getZoomDestinationForLine } from "../../utils/zoom";
import RouteForm from "../route-form/route-form";
import StringMap from "../../utils/string-map";

@WithRender
@Component({
	components: { EditLine, ElevationPlot, ElevationStats, Icon, RouteForm }
})
export default class LineInfo extends Vue {
	
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Ref() routeForm?: RouteForm;

	@Prop({ type: IdType, required: true }) lineId!: ID;
	@Prop({ type: Boolean, default: false }) showBackButton!: boolean;

	isDeleting = false;
	isExporting = false;
	showElevationPlot = false;
	isMoving = false;

	get line(): Line<StringMap> | undefined {
		return this.client.lines[this.lineId];
	}

	async deleteLine(): Promise<void> {
		this.$bvToast.hide("fm-line-info-delete");

		if (!this.line || !await this.$bvModal.msgBoxConfirm(`Do you really want to remove the line “${this.line.name}”?`))
			return;
		
		this.isDeleting = true;

		try {
			await this.client.deleteLine({ id: this.lineId });
		} catch (err) {
			showErrorToast(this, "fm-line-info-delete", "Error deleting line", err);
		} finally {
			this.isDeleting = false;
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
		this.isExporting = true;

		try {
			const exported = await this.client.exportLine({ id: this.line.id, format });
			saveAs(new Blob([exported], { type: "application/gpx+xml" }), `${this.line.name}.gpx`);
		} catch(err) {
			showErrorToast(this, "fm-line-info-export-error", "Error exporting line", err);
		} finally {
			this.isExporting = false;
		}
	}

	async moveLine(): Promise<void> {
		this.$bvToast.hide("fm-line-info-move-error");

		if (!this.line)
			return;

		this.mapComponents.map.fire('fmInteractionStart');
		const routeId = `l${this.line.id}`;

		try {
			await this.client.lineToRoute({ id: this.line.id, routeId });

			this.mapComponents.linesLayer.hideLine(this.line.id);

			showToast(this, "fm-line-info-move", `Edit waypoints`, "Use the routing form or drag the line around to change it. Click “Finish” to save the changes.", {
				actions: [
					{ label: "Finish", onClick: () => { done(true); }},
					{ label: "Cancel", onClick: () => { done(false); } }
				]
			});

			this.isMoving = true;

			await new Promise((resolve) => {
				setTimeout(resolve);
			});

			const done = async (save: boolean) => {
				const route = this.client.routes[routeId];
				if (save && !route)
					return;

				this.$bvToast.hide("fm-line-info-move");

				try {
					if(save)
						await this.client.editLine({ id: this.line!.id, routePoints: route.routePoints, mode: route.mode });
				} catch (err) {
					showErrorToast(this, "fm-line-info-move-error", "Error saving line", err);
				} finally {
					this.mapComponents.map.fire('fmInteractionEnd');
					this.isMoving = false;

					// Clear route after editing line so that the server can take the trackPoints from the route
					this.client.clearRoute({ routeId }).catch((err) => {
						console.error("Error clearing route", err);
					});

					this.mapComponents.linesLayer.unhideLine(this.line!.id);
				}
			};
		} catch (err) {
			showErrorToast(this, "fm-line-info-move-error", "Error saving line", err);

			this.$bvToast.hide("fm-line-info-move");
			this.mapComponents.map.fire('fmInteractionEnd');
			this.isMoving = false;
			this.client.clearRoute({ routeId }).catch((err) => {
				console.error("Error clearing route", err);
			});
			this.mapComponents.linesLayer.unhideLine(this.line!.id);
		}
	}

}