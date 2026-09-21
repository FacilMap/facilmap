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
	import { computed, ref } from "vue";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ExportDropdown from "../ui/export-dropdown.vue";
	import { useI18n } from "../../utils/i18n";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { vKeyboardShortcut } from "../../utils/vue";
	import { useSplitLine } from "./split-line";
	import { useMoveLine } from "./move-line";
	import { useDeleteLine } from "./delete-line";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

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

	const showEditDialog = ref(false);
	const showElevationPlot = ref(false);

	const line = computed(() => client.value.lines[props.lineId]);

	const moveLine = useMoveLine(line);
	const splitLine = useSplitLine(line);
	const deleteLine = useDeleteLine(line);

	const typeName = computed(() => formatTypeName(client.value.types[line.value.typeId].name));
	const showTypeName = computed(() => Object.values(client.value.types).filter((t) => t.type === 'line').length > 1);

	async function getExport(format: "gpx-trk" | "gpx-rte"): Promise<string> {
		return await client.value.exportLine({ id: line.value.id, format });
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
			<div v-if="!moveLine.isMoving" class="btn-toolbar">
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

		<div class="fm-search-box-collapse-point" v-if="!moveLine.isMoving">
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
						<dd v-html="client.mapData && formatFieldValue(client.mapData, client.types[line.typeId], field, line, true)"></dd>
					</template>
				</template>
			</dl>

			<ElevationPlot :route="line" v-if="line.ascent != null && showElevationPlot"></ElevationPlot>
		</div>

		<div v-if="!moveLine.isMoving" class="btn-toolbar fm-search-box-toolbar">
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
				:disabled="deleteLine.isDeleting || mapContext.interaction"
				v-keyboard-shortcut="'e'"
			>{{i18n.t("line-info.edit-data")}}</button>

			<DropdownMenu
				v-if="!client.readonly"
				size="sm"
				:label="i18n.t('line-info.actions')"
				:isBusy="deleteLine.isDeleting"
				:isDisabled="mapContext.interaction"
			>
				<li>
					<a
						v-if="line.mode != 'track'"
						href="javascript:"
						class="dropdown-item"
						@click="moveLine.move()"
					>{{i18n.t("line-info.edit-waypoints")}}</a>
				</li>

				<li>
					<a
						v-if="line.mode != 'track'"
						href="javascript:"
						class="dropdown-item"
						@click="splitLine.split(($event as PointerEvent).pointerType === 'touch')"
					>{{i18n.t("line-info.split")}}</a>
				</li>

				<li>
					<a
						href="javascript:"
						class="dropdown-item"
						@click="deleteLine.del()"
						v-keyboard-shortcut="['Delete', 'Backspace']"
					>{{i18n.t("line-info.delete")}}</a>
				</li>
			</DropdownMenu>
		</div>

		<RouteForm
			v-if="moveLine.isMoving"
			active
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