<script setup lang="ts">
	import WithRender from "./line-info.vue";
	import Vue from "vue";
	import { Component, Prop, Ref } from "vue-property-decorator";
	import { ExportFormat, ID, Line } from "facilmap-types";
	import { IdType } from "../../utils/utils";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
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
	import { Context } from "../facilmap/facilmap";
	import saveAs from "file-saver";

	@WithRender
	@Component({
		components: { EditLine, ElevationPlot, ElevationStats, Icon, RouteForm }
	})
	export default class LineInfo extends Vue {

		@InjectContext() context!: Context;
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
			this.$bvToast.hide(`fm${this.context.id}-line-info-delete`);

			if (!this.line || !await this.$bvModal.msgBoxConfirm(`Do you really want to remove the line “${this.line.name}”?`))
				return;

			this.isDeleting = true;

			try {
				await this.client.deleteLine({ id: this.lineId });
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-line-info-delete`, "Error deleting line", err);
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

			this.$bvToast.hide(`fm${this.context.id}-line-info-export-error`);
			this.isExporting = true;

			try {
				const exported = await this.client.exportLine({ id: this.line.id, format });
				saveAs(new Blob([exported], { type: "application/gpx+xml" }), `${this.line.name}.gpx`);
			} catch(err) {
				showErrorToast(this, `fm${this.context.id}-line-info-export-error`, "Error exporting line", err);
			} finally {
				this.isExporting = false;
			}
		}

		async moveLine(): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-line-info-move-error`);

			if (!this.line)
				return;

			this.mapComponents.map.fire('fmInteractionStart');
			const routeId = `l${this.line.id}`;

			try {
				await this.client.lineToRoute({ id: this.line.id, routeId });

				this.mapComponents.linesLayer.hideLine(this.line.id);

				showToast(this, `fm${this.context.id}-line-info-move`, `Edit waypoints`, "Use the routing form or drag the line around to change it. Click “Finish” to save the changes.", {
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

					this.$bvToast.hide(`fm${this.context.id}-line-info-move`);

					try {
						if(save)
							await this.client.editLine({ id: this.line!.id, routePoints: route.routePoints, mode: route.mode });
					} catch (err) {
						showErrorToast(this, `fm${this.context.id}-line-info-move-error`, "Error saving line", err);
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
				showErrorToast(this, `fm${this.context.id}-line-info-move-error`, "Error saving line", err);

				this.$bvToast.hide(`fm${this.context.id}-line-info-move`);
				this.mapComponents.map.fire('fmInteractionEnd');
				this.isMoving = false;
				this.client.clearRoute({ routeId }).catch((err) => {
					console.error("Error clearing route", err);
				});
				this.mapComponents.linesLayer.unhideLine(this.line!.id);
			}
		}

	}
</script>

<template>
	<div class="fm-line-info" v-if="line">
		<div class="d-flex align-items-center">
			<h2 class="flex-grow-1">
				<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
				{{line.name}}
			</h2>
			<b-button-toolbar v-if="!isMoving">
				<b-button
					v-if="line.ascent != null"
					:pressed.sync="showElevationPlot"
					v-b-tooltip.hover.right="`${showElevationPlot ? 'Hide' : 'Show'} elevation plot`"
				><Icon icon="chart-line" :alt="`${showElevationPlot ? 'Hide' : 'Show'} elevation plot`"></Icon></b-button>

			</b-button-toolbar>
		</div>

		<div class="fm-search-box-collapse-point" v-if="!isMoving">
			<dl>
				<dt class="distance">Distance</dt>
				<dd class="distance">{{line.distance | round(2)}} km <span v-if="line.time != null">({{line.time | fmFormatTime}} h {{line.mode | fmRouteMode}})</span></dd>

				<template v-if="line.ascent != null">
					<dt class="elevation">Climb/drop</dt>
					<dd class="elevation"><ElevationStats :route="line"></ElevationStats></dd>
				</template>

				<template v-if="line.ascent == null || !showElevationPlot" v-for="field in client.types[line.typeId].fields">
					<dt>{{field.name}}</dt>
					<dd v-html="$options.filters.fmFieldContent(line.data.get(field.name), field)"></dd>
				</template>
			</dl>

			<ElevationPlot :route="line" v-if="line.ascent != null && showElevationPlot"></ElevationPlot>
		</div>

		<b-button-toolbar v-if="!isMoving">
			<b-button v-b-tooltip.hover="'Zoom to line'" @click="zoomToLine()" size="sm"><Icon icon="zoom-in" alt="Zoom to line"></Icon></b-button>

			<b-dropdown size="sm" :disabled="isExporting">
				<template #button-content>
					<div v-if="isExporting" class="spinner-border spinner-border-sm"></div>
					Export
				</template>

				<b-dropdown-item
					href="javascript:"
					@click="exportRoute('gpx-trk')"
					v-b-tooltip.hover.right="'GPX files can be opened with most navigation software. In track mode, the calculated route is saved in the file.'"
				>Export as GPX track</b-dropdown-item>
				<b-dropdown-item
					href="javascript:"
					@click="exportRoute('gpx-rte')"
					v-b-tooltip.hover.right="'GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to calculate the route.'"
				>Export as GPX route</b-dropdown-item>
			</b-dropdown>

			<b-button v-if="!client.readonly" size="sm" v-b-modal="`fm${context.id}-line-info-edit`" :disabled="isDeleting || mapContext.interaction">Edit data</b-button>

			<b-button v-if="!client.readonly && line.mode != 'track'" size="sm" @click="moveLine()" :disabled="isDeleting || mapContext.interaction">Edit waypoints</b-button>

			<b-button v-if="!client.readonly" size="sm" @click="deleteLine()" :disabled="isDeleting || mapContext.interaction">
				<div v-if="isDeleting" class="spinner-border spinner-border-sm"></div>
				Remove
			</b-button>
		</b-button-toolbar>

		<RouteForm v-if="isMoving" active ref="routeForm" :route-id="`l${line.id}`" :show-toolbar="false"></RouteForm>

		<EditLine :id="`fm${context.id}-line-info-edit`" :line-id="lineId"></EditLine>
	</div>
</template>

<style lang="scss">
	.fm-line-info {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex-grow: 1;

		.fm-search-box-collapse-point {
			display: flex;
			flex-direction: column;
			min-height: 1.5em;
			flex-grow: 1;
		}

		.fm-elevation-plot {
			margin-bottom: 1rem;
		}
	}
</style>