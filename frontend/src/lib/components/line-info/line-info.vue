<script setup lang="ts">
	import type { ExportFormat, ID } from "facilmap-types";
	import EditLineDialog from "../edit-line-dialog.vue";
	import ElevationStats from "../ui/elevation-stats.vue";
	import ElevationPlot from "../ui/elevation-plot.vue";
	import Icon from "../ui/icon.vue";
	import { getZoomDestinationForLine } from "../../utils/zoom";
	import RouteForm from "../route-form/route-form.vue";
	import vTooltip from "../../utils/tooltip";
	import { formatField, formatRouteMode, formatTime, normalizeLineName, round } from "facilmap-utils";
	import { computed, ref } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ExportDropdown from "../ui/export-dropdown.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

	const toasts = useToasts();

	const props = withDefaults(defineProps<{
		lineId: ID;
		showBackButton?: boolean;
	}>(), {
		showBackButton: false
	});

	const emit = defineEmits<{
		back: [];
	}>();

	const routeForm = ref<InstanceType<typeof RouteForm>>();

	const showEditDialog = ref(false);
	const isDeleting = ref(false);
	const showElevationPlot = ref(false);
	const isMoving = ref(false);

	const line = computed(() => client.value.lines[props.lineId]);

	const typeName = computed(() => client.value.types[line.value.typeId].name);
	const showTypeName = computed(() => Object.values(client.value.types).filter((t) => t.type === 'line').length > 1);

	async function deleteLine(): Promise<void> {
		toasts.hideToast(`fm${context.id}-line-info-delete`);

		if (!await showConfirm({
			title: "Delete line",
			message: `Do you really want to delete the line “${normalizeLineName(line.value.name)}”?`,
			variant: "danger",
			okLabel: "Delete"
		}))
			return;

		isDeleting.value = true;

		try {
			await client.value.deleteLine({ id: props.lineId });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-line-info-delete`, "Error deleting line", err);
		} finally {
			isDeleting.value = false;
		}
	}

	async function getExport(format: ExportFormat): Promise<string> {
		return await client.value.exportLine({ id: line.value.id, format });
	}

	async function moveLine(): Promise<void> {
		toasts.hideToast(`fm${context.id}-line-info-move-error`);

		mapContext.value.components.map.fire('fmInteractionStart');
		const routeId = `l${line.value.id}`;

		try {
			await client.value.lineToRoute({ id: line.value.id, routeId });

			mapContext.value.components.linesLayer.hideLine(line.value.id);

			const done = async (save: boolean) => {
				const route = client.value.routes[routeId];
				if (save && !route)
					return;

				toasts.hideToast(`fm${context.id}-line-info-move`);

				try {
					if(save)
						await client.value.editLine({ id: line.value.id, routePoints: route.routePoints, mode: route.mode });
				} catch (err) {
					toasts.showErrorToast(`fm${context.id}-line-info-move-error`, "Error saving line", err);
				} finally {
					mapContext.value.components.map.fire('fmInteractionEnd');
					isMoving.value = false;

					// Clear route after editing line so that the server can take the trackPoints from the route
					client.value.clearRoute({ routeId }).catch((err) => {
						console.error("Error clearing route", err);
					});

					mapContext.value.components.linesLayer.unhideLine(line.value.id);
				}
			};

			toasts.showToast(`fm${context.id}-line-info-move`, `Edit waypoints`, "Use the routing form or drag the line around to change it. Click “Finish” to save the changes.", {
				noCloseButton: true,
				actions: [
					{ label: "Finish", variant: "primary", onClick: () => { done(true); }},
					{ label: "Cancel", onClick: () => { done(false); } }
				]
			});

			isMoving.value = true;
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-line-info-move-error`, "Error saving line", err);

			toasts.hideToast(`fm${context.id}-line-info-move`);
			mapContext.value.components.map.fire('fmInteractionEnd');
			isMoving.value = false;
			client.value.clearRoute({ routeId }).catch((err) => {
				console.error("Error clearing route", err);
			});
			mapContext.value.components.linesLayer.unhideLine(line.value.id);
		}
	}

	const zoomDestination = computed(() => getZoomDestinationForLine(line.value));
</script>

<template>
	<div class="fm-line-info" v-if="line">
		<div class="d-flex align-items-center">
			<h2 class="flex-grow-1 text-break">
				<a v-if="showBackButton" href="javascript:" @click="emit('back')"><Icon icon="arrow-left"></Icon></a>
				<span>
					{{normalizeLineName(line.name)}}
					<template v-if="showTypeName">
						<span class="type-name">({{typeName}})</span>
					</template>
				</span>
			</h2>
			<div v-if="!isMoving" class="btn-toolbar">
				<button
					v-if="line.ascent != null"
					type="button"
					class="btn btn-secondary"
					:class="{ active: showElevationPlot }"
					@click="showElevationPlot = !showElevationPlot"
					v-tooltip.right="`${showElevationPlot ? 'Hide' : 'Show'} elevation plot`"
				>
					<Icon icon="chart-line" :alt="`${showElevationPlot ? 'Hide' : 'Show'} elevation plot`"></Icon>
				</button>
			</div>
		</div>

		<div class="fm-search-box-collapse-point" v-if="!isMoving">
			<dl class="fm-search-box-dl">
				<dt class="distance">Distance</dt>
				<dd class="distance">{{round(line.distance, 2)}}&#x202F;km <span v-if="line.time != null">({{formatTime(line.time)}}&#x202F;h {{formatRouteMode(line.mode)}})</span></dd>

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

		<div v-if="!isMoving" class="btn-toolbar">
			<ZoomToObjectButton
				v-if="zoomDestination"
				label="line"
				size="sm"
				:destination="zoomDestination"
			></ZoomToObjectButton>

			<ExportDropdown
				:filename="normalizeLineName(line.name)"
				:getExport="getExport"
				size="sm"
			></ExportDropdown>

			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-secondary btn-sm"
				size="sm"
				@click="showEditDialog = true"
				:disabled="isDeleting || mapContext.interaction"
			>Edit data</button>

			<button
				v-if="!client.readonly && line.mode != 'track'"
				type="button"
				class="btn btn-secondary btn-sm"
				@click="moveLine()"
				:disabled="isDeleting || mapContext.interaction"
			>Edit waypoints</button>

			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-secondary btn-sm"
				@click="deleteLine()"
				:disabled="isDeleting || mapContext.interaction"
			>
				<div v-if="isDeleting" class="spinner-border spinner-border-sm"></div>
				Delete
			</button>
		</div>

		<RouteForm
			v-if="isMoving"
			active
			ref="routeForm"
			:routeId="`l${line.id}`"
			:showToolbar="false"
			noClear
		></RouteForm>

		<EditLineDialog
			v-if="showEditDialog"
			:lineId="lineId"
			@hidden="showEditDialog = false"
		></EditLineDialog>
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

		.type-name {
			color: #888;
			font-size: 0.7em;
		}

		.fm-elevation-plot {
			margin-bottom: 0.5rem;
		}
	}
</style>