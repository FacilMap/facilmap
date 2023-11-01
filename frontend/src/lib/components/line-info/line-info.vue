<script setup lang="ts">
	import { ExportFormat, ID } from "facilmap-types";
	import EditLineDialog from "../edit-line-dialog.vue";
	import ElevationStats from "../ui/elevation-stats.vue";
	import ElevationPlot from "../ui/elevation-plot.vue";
	import Icon from "../ui/icon.vue";
	import { flyTo, getZoomDestinationForLine } from "../../utils/zoom";
	import RouteForm from "../route-form/route-form.vue";
	import { saveAs } from "file-saver";
	import vTooltip from "../../utils/tooltip";
	import { formatField, formatRouteMode, formatTime, round } from "facilmap-utils";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";
	import { computed, ref } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	const toasts = useToasts();

	const props = withDefaults(defineProps<{
		lineId: ID;
		showBackButton?: boolean;
	}>(), {
		showBackButton: false
	});

	const routeForm = ref<InstanceType<typeof RouteForm>>();

	const isDeleting = ref(false);
	const isExporting = ref(false);
	const showElevationPlot = ref(false);
	const isMoving = ref(false);

	const line = computed(() => client.lines[props.lineId]);

	async function deleteLine(): Promise<void> {
		toasts.hideToast(`fm${context.id}-line-info-delete`);

		if (!line.value || !await showConfirm({ title: "Remove line", message: `Do you really want to remove the line “${line.value.name}”?` }))
			return;

		isDeleting.value = true;

		try {
			await client.deleteLine({ id: props.lineId });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-line-info-delete`, "Error deleting line", err);
		} finally {
			isDeleting.value = false;
		}
	}

	function zoomToLine(): void {
		if (line.value)
			flyTo(mapContext.components.map, getZoomDestinationForLine(line.value));
	}

	async function exportRoute(format: ExportFormat): Promise<void> {
		if (!line.value)
			return;

		toasts.hideToast(`fm${context.id}-line-info-export-error`);
		isExporting.value = true;

		try {
			const exported = await client.exportLine({ id: line.value.id, format });
			saveAs(new Blob([exported], { type: "application/gpx+xml" }), `${line.value.name}.gpx`);
		} catch(err) {
			toasts.showErrorToast(`fm${context.id}-line-info-export-error`, "Error exporting line", err);
		} finally {
			isExporting.value = false;
		}
	}

	async function moveLine(): Promise<void> {
		toasts.hideToast(`fm${context.id}-line-info-move-error`);

		if (!line.value)
			return;

		mapContext.components.map.fire('fmInteractionStart');
		const routeId = `l${line.value.id}`;

		try {
			await client.lineToRoute({ id: line.value.id, routeId });

			mapContext.components.linesLayer.hideLine(line.value.id);

			toasts.showToast(`fm${context.id}-line-info-move`, `Edit waypoints`, "Use the routing form or drag the line around to change it. Click “Finish” to save the changes.", {
				actions: [
					{ label: "Finish", onClick: () => { done(true); }},
					{ label: "Cancel", onClick: () => { done(false); } }
				]
			});

			isMoving.value = true;

			await new Promise((resolve) => {
				setTimeout(resolve);
			});

			const done = async (save: boolean) => {
				const route = client.routes[routeId];
				if (save && !route)
					return;

				toasts.hideToast(`fm${context.id}-line-info-move`);

				try {
					if(save)
						await client.editLine({ id: line.value.id, routePoints: route.routePoints, mode: route.mode });
				} catch (err) {
					toasts.showErrorToast(`fm${context.id}-line-info-move-error`, "Error saving line", err);
				} finally {
					mapContext.components.map.fire('fmInteractionEnd');
					isMoving.value = false;

					// Clear route after editing line so that the server can take the trackPoints from the route
					client.clearRoute({ routeId }).catch((err) => {
						console.error("Error clearing route", err);
					});

					mapContext.components.linesLayer.unhideLine(line.value.id);
				}
			};
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-line-info-move-error`, "Error saving line", err);

			toasts.hideToast(`fm${context.id}-line-info-move`);
			mapContext.components.map.fire('fmInteractionEnd');
			isMoving.value = false;
			client.clearRoute({ routeId }).catch((err) => {
				console.error("Error clearing route", err);
			});
			mapContext.components.linesLayer.unhideLine(line.value.id);
		}
	}
</script>

<template>
	<div class="fm-line-info" v-if="line">
		<div class="d-flex align-items-center">
			<h2 class="flex-grow-1">
				<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
				{{line.name || "Untitled line"}}
			</h2>
			<div v-if="!isMoving" class="btn-group">
				<button
					v-if="line.ascent != null"
					type="button"
					class="btn btn-light"
					:class="{ active: showElevationPlot }"
					@click="showElevationPlot = !showElevationPlot"
					v-tooltip.right="`${showElevationPlot ? 'Hide' : 'Show'} elevation plot`"
				>
					<Icon icon="chart-line" :alt="`${showElevationPlot ? 'Hide' : 'Show'} elevation plot`"></Icon>
				</button>
			</div>
		</div>

		<div class="fm-search-box-collapse-point" v-if="!isMoving">
			<dl>
				<dt class="distance">Distance</dt>
				<dd class="distance">{{round(line.distance, 2)}} km <span v-if="line.time != null">({{formatTime(line.time)}} h {{formatRouteMode(line.mode)}})</span></dd>

				<template v-if="line.ascent != null">
					<dt class="elevation">Climb/drop</dt>
					<dd class="elevation"><ElevationStats :route="line"></ElevationStats></dd>
				</template>

				<template v-if="line.ascent == null || !showElevationPlot">
					<template v-for="field in client.types[line.typeId].fields" :key="field.name">
						<dt>{{field.name}}</dt>
						<dd v-html="formatField(field, line.data[field.name])"></dd>
					</template>
				</template>
			</dl>

			<ElevationPlot :route="line" v-if="line.ascent != null && showElevationPlot"></ElevationPlot>
		</div>

		<div v-if="!isMoving" class="btn-group">
			<button
				type="button"
				class="btn btn-light btn-sm"
				v-tooltip="'Zoom to line'"
				@click="zoomToLine()"
			>
				<Icon icon="zoom-in" alt="Zoom to line"></Icon>
			</button>

			<div class="dropdown">
				<button type="button" class="btn btn-light dropdown-toggle btn-sm" :disabled="isExporting">
					<div v-if="isExporting" class="spinner-border spinner-border-sm"></div>
					Export
				</button>

				<ul class="dropdown-menu">
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="exportRoute('gpx-trk')"
							v-tooltip.right="'GPX files can be opened with most navigation software. In track mode, the calculated route is saved in the file.'"
						>Export as GPX track</a>
					</li>
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="exportRoute('gpx-rte')"
							v-tooltip.right="'GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to calculate the route.'"
						>Export as GPX route</a>
					</li>
				</ul>
			</div>

			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-light btn-sm"
				size="sm"
				v-b-modal="`fm${context.id}-line-info-edit`"
				:disabled="isDeleting || mapContext.interaction"
			>Edit data</button>

			<button
				v-if="!client.readonly && line.mode != 'track'"
				type="button"
				class="btn btn-light btn-sm"
				@click="moveLine()"
				:disabled="isDeleting || mapContext.interaction"
			>Edit waypoints</button>

			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-light btn-sm"
				@click="deleteLine()"
				:disabled="isDeleting || mapContext.interaction"
			>
				<div v-if="isDeleting" class="spinner-border spinner-border-sm"></div>
				Remove
			</button>
		</div>

		<RouteForm v-if="isMoving" active ref="routeForm" :route-id="`l${line.id}`" :show-toolbar="false"></RouteForm>

		<EditLineDialog :id="`fm${context.id}-line-info-edit`" :line-id="lineId"></EditLineDialog>
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