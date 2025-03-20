<script setup lang="ts">
	import type { ID } from "facilmap-types";
	import EditLineDialog from "../edit-line-dialog.vue";
	import ElevationStats from "../ui/elevation-stats.vue";
	import ElevationPlot from "../ui/elevation-plot.vue";
	import Icon from "../ui/icon.vue";
	import { getZoomDestinationForLine } from "../../utils/zoom";
	import RouteForm from "../route-form/route-form.vue";
	import vTooltip from "../../utils/tooltip";
	import { formatDistance, formatFieldName, formatFieldValue, formatRouteTime, formatTypeName, normalizeLineName } from "facilmap-utils";
	import { computed, reactive, ref, toRef } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ExportDropdown from "../ui/export-dropdown.vue";
	import { useI18n } from "../../utils/i18n";
	import DropdownMenu from "../ui/dropdown-menu.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

	const toasts = useToasts();
	const i18n = useI18n();

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

	const typeName = computed(() => formatTypeName(client.value.types[line.value.typeId].name));
	const showTypeName = computed(() => Object.values(client.value.types).filter((t) => t.type === 'line').length > 1);

	async function deleteLine(): Promise<void> {
		toasts.hideToast(`fm${context.id}-line-info-delete`);

		if (!await showConfirm({
			title: i18n.t("line-info.delete-line-title"),
			message: i18n.t("line-info.delete-line-message", { name: normalizeLineName(line.value.name) }),
			variant: "danger",
			okLabel: i18n.t("line-info.delete-line-ok")
		}))
			return;

		isDeleting.value = true;

		try {
			await client.value.deleteLine({ id: props.lineId });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-line-info-delete`, () => i18n.t("line-info.delete-line-error"), err);
		} finally {
			isDeleting.value = false;
		}
	}

	async function getExport(format: "gpx-trk" | "gpx-rte"): Promise<string> {
		return await client.value.exportLine({ id: line.value.id, format });
	}

	async function moveLine(): Promise<void> {
		toasts.hideToast(`fm${context.id}-line-info-move`);

		mapContext.value.components.map.fire('fmInteractionStart');
		const routeKey = `l${line.value.id}`;

		try {
			await client.value.lineToRoute({ id: line.value.id, routeKey });

			mapContext.value.components.linesLayer.hideLine(line.value.id);

			const isSaving = ref(false);

			const done = async (save: boolean) => {
				const route = client.value.routes[routeKey];
				if (save && !route)
					return;

				try {
					if(save) {
						isSaving.value = true;
						await client.value.editLine({ id: line.value.id, routePoints: route.routePoints, mode: route.mode });
					}

					toasts.hideToast(`fm${context.id}-line-info-move`);
				} catch (err) {
					toasts.showErrorToast(`fm${context.id}-line-info-move`, () => i18n.t("line-info.save-line-error"), err);
				} finally {
					mapContext.value.components.map.fire('fmInteractionEnd');
					isMoving.value = false;

					// Clear route after editing line so that the server can take the trackPoints from the route
					client.value.clearRoute({ routeKey }).catch((err) => {
						console.error("Error clearing route", err);
					});

					mapContext.value.components.linesLayer.unhideLine(line.value.id);
				}
			};

			toasts.showToast(`fm${context.id}-line-info-move`, () => i18n.t("line-info.move-line-title"), () => i18n.t("line-info.move-line-message"), reactive({
				noCloseButton: true,
				actions: toRef(() => [
					{
						label: i18n.t("line-info.move-line-finish"),
						variant: "primary" as const,
						onClick: () => { void done(true); },
						isPending: isSaving.value,
						isDisabled: isSaving.value
					},
					{
						label: i18n.t("line-info.move-line-cancel"),
						onClick: () => { void done(false); },
						isDisabled: isSaving.value
					}
				])
			}));

			isMoving.value = true;
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-line-info-move-error`, () => i18n.t("line-info.save-line-error"), err);

			toasts.hideToast(`fm${context.id}-line-info-move`);
			mapContext.value.components.map.fire('fmInteractionEnd');
			isMoving.value = false;
			client.value.clearRoute({ routeKey }).catch((err) => {
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
					v-tooltip.right="showElevationPlot ? i18n.t('line-info.hide-elevation-plot') : i18n.t('line-info.show-elevation-plot')"
				>
					<Icon icon="chart-line" :alt="showElevationPlot ? i18n.t('line-info.hide-elevation-plot') : i18n.t('line-info.show-elevation-plot')"></Icon>
				</button>
			</div>
		</div>

		<div class="fm-search-box-collapse-point" v-if="!isMoving">
			<dl class="fm-search-box-dl">
				<dt class="distance">{{i18n.t("line-info.distance")}}</dt>
				<dd class="distance">{{formatDistance(line.distance)}} <span v-if="line.time != null">({{formatRouteTime(line.time, line.mode)}})</span></dd>

				<template v-if="line.ascent != null">
					<dt class="elevation">{{i18n.t("line-info.ascent-descent")}}</dt>
					<dd class="elevation"><ElevationStats :route="line"></ElevationStats></dd>
				</template>

				<template v-if="line.ascent == null || !showElevationPlot">
					<template v-for="field in client.types[line.typeId].fields" :key="field.name">
						<dt>{{formatFieldName(field.name)}}</dt>
						<dd v-html="formatFieldValue(field, line.data[field.name], true)"></dd>
					</template>
				</template>
			</dl>

			<ElevationPlot :route="line" v-if="line.ascent != null && showElevationPlot"></ElevationPlot>
		</div>

		<div v-if="!isMoving" class="btn-toolbar">
			<ZoomToObjectButton
				v-if="zoomDestination"
				:label="i18n.t('line-info.zoom-to-object-label')"
				size="sm"
				:destination="zoomDestination"
			></ZoomToObjectButton>

			<ExportDropdown
				:filename="normalizeLineName(line.name)"
				:getExport="getExport"
				:formats="['gpx-trk', 'gpx-rte']"
				size="sm"
			></ExportDropdown>

			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-secondary btn-sm"
				size="sm"
				@click="showEditDialog = true"
				:disabled="isDeleting || mapContext.interaction"
			>{{i18n.t("line-info.edit-data")}}</button>

			<DropdownMenu
				v-if="!client.readonly"
				size="sm"
				:label="i18n.t('line-info.actions')"
				:isBusy="isDeleting"
				:isDisabled="mapContext.interaction"
			>
				<li>
					<a
						v-if="line.mode != 'track'"
						href="javascript:"
						class="dropdown-item"
						@click="moveLine()"
					>{{i18n.t("line-info.edit-waypoints")}}</a>
				</li>

				<li>
					<a
						href="javascript:"
						class="dropdown-item"
						@click="deleteLine()"
					>{{i18n.t("line-info.delete")}}</a>
				</li>
			</DropdownMenu>
		</div>

		<RouteForm
			v-if="isMoving"
			active
			ref="routeForm"
			:routeKey="`l${line.id}`"
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