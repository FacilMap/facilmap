<script setup lang="ts">
	import { type ID } from "facilmap-types";
	import { moveMarker } from "../../utils/draw";
	import EditMarkerDialog from "../edit-marker-dialog.vue";
	import { getZoomDestinationForMarker } from "../../utils/zoom";
	import Icon from "../ui/icon.vue";
	import Coordinates from "../ui/coordinates.vue";
	import { canManageObject, canUpdateAnyField, formatFieldName, formatFieldValue, formatTypeName, normalizeMarkerName } from "facilmap-utils";
	import { computed, ref } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";
	import UseAsDropdown from "../ui/use-as-dropdown.vue";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { injectContextRequired, requireClientContext, requireClientSub, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import type { RouteDestination } from "../facil-map-context-provider/route-form-tab-context";
	import { useI18n } from "../../utils/i18n";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import type { MapResult } from "../../utils/search";

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = requireClientSub(context);
	const mapContext = requireMapContext(context);
	const toasts = useToasts();
	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		markerId: ID;
		showBackButton?: boolean;
		zoom?: number;
	}>(), {
		showBackButton: false
	});

	const emit = defineEmits<{
		back: [];
	}>();

	const isBusy = ref(false);
	const showEditDialog = ref(false);

	const marker = computed(() => clientContext.value.map!.data!.markers[props.markerId]);
	const type = computed(() => clientContext.value.map!.data!.types[marker.value.typeId]);

	const canEdit = computed(() => canUpdateAnyField(clientSub.value.activeLink.permissions, marker.value.typeId, marker.value.own));
	const canDelete = computed(() => canManageObject(clientSub.value.activeLink.permissions, marker.value.typeId, marker.value.own));

	const typeName = computed(() => formatTypeName(type.value.name));
	const showTypeName = computed(() => Object.values(clientContext.value.map!.data!.types).filter((t) => t.type === 'marker').length > 1);

	function move(): void {
		moveMarker(props.markerId, context, toasts);
	}

	async function deleteMarker(): Promise<void> {
		toasts.hideToast(`fm${context.id}-marker-info-delete`);

		if (!await showConfirm({
			title: i18n.t("marker-info.delete-marker-title"),
			message: i18n.t("marker-info.delete-marker-message", { name: normalizeMarkerName(marker.value.name) }),
			variant: "danger",
			okLabel: i18n.t("marker-info.delete-marker-ok")
		}))
			return;

		isBusy.value = true;

		try {
			await clientContext.value.client.deleteMarker(clientContext.value.map!.mapSlug, props.markerId);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-marker-info-delete`, () => i18n.t("marker-info.delete-marker-error"), err);
		} finally {
			isBusy.value = false;
		}
	}

	const zoomDestination = computed(() => getZoomDestinationForMarker(marker.value));

	const routeDestination = computed<RouteDestination>(() => {
		const markerSuggestion: MapResult = { ...marker.value, mapSlug: clientContext.value.map!.mapSlug, kind: "marker", similarity: 1 };
		return {
			query: normalizeMarkerName(marker.value.name),
			mapSuggestions: [markerSuggestion],
			selectedSuggestion: markerSuggestion
		};
	});
</script>

<template>
	<div class="fm-marker-info" v-if="marker">
		<h2 class="text-break">
			<a v-if="showBackButton" href="javascript:" @click="emit('back')"><Icon icon="arrow-left"></Icon></a>
			<span>
				{{normalizeMarkerName(marker.name)}}
				<template v-if="showTypeName">
					<span class="type-name">({{typeName}})</span>
				</template>
			</span>
		</h2>
		<dl class="fm-search-box-collapse-point fm-search-box-dl">
			<dt class="pos">{{i18n.t("common.coordinates")}}</dt>
			<dd class="pos"><Coordinates :point="marker" :ele="marker.ele" :zoom="props.zoom"></Coordinates></dd>

			<template v-for="field in type.fields" :key="field.name">
				<dt>{{formatFieldName(field.name)}}</dt>
				<dd v-html="formatFieldValue(field, marker.data[field.id], true)"></dd>
			</template>
		</dl>

		<div class="btn-toolbar">
			<ZoomToObjectButton
				v-if="zoomDestination"
				:label="i18n.t('marker-info.zoom-to-object-label')"
				size="sm"
				:destination="zoomDestination"
			></ZoomToObjectButton>

			<UseAsDropdown
				size="sm"
				:destination="routeDestination"
			></UseAsDropdown>

			<button
				v-if="canEdit"
				type="button"
				class="btn btn-secondary btn-sm"
				@click="showEditDialog = true"
				:disabled="isBusy || mapContext.interaction"
			>{{i18n.t("marker-info.edit-data")}}</button>

			<DropdownMenu
				v-if="canEdit || canDelete"
				size="sm"
				:label="i18n.t('marker-info.actions')"
				:isBusy="isBusy"
				:isDisabled="mapContext.interaction"
			>
				<li v-if="canEdit">
					<a
						href="javascript:"
						class="dropdown-item"
						@click="move()"
					>{{i18n.t("marker-info.move")}}</a>
				</li>

				<li v-if="canDelete">
					<a
						href="javascript:"
						class="dropdown-item"
						@click="deleteMarker()"
					>{{i18n.t("marker-info.delete")}}</a>
				</li>
			</DropdownMenu>
		</div>

		<EditMarkerDialog
			v-if="showEditDialog"
			:markerId="markerId"
			@hidden="showEditDialog = false"
		></EditMarkerDialog>
	</div>
</template>

<style lang="scss">
	.fm-marker-info {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.fm-search-box-collapse-point {
			min-height: 1.5em;
		}

		.type-name {
			color: #888;
			font-size: 0.7em;
		}
	}
</style>