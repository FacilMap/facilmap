<script setup lang="ts">
	import type { FindOnMapResult, ID } from "facilmap-types";
	import { moveMarker } from "../../utils/draw";
	import EditMarkerDialog from "../edit-marker-dialog.vue";
	import { flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
	import Icon from "../ui/icon.vue";
	import Coordinates from "../ui/coordinates.vue";
	import vTooltip from "../../utils/tooltip";
	import { formatField, normalizeMarkerName } from "facilmap-utils";
	import { computed, ref } from "vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";
	import { injectClientRequired } from "../client-context.vue";
	import { injectContextRequired } from "../../utils/context";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();
	const toasts = useToasts();

	const props = withDefaults(defineProps<{
		markerId: ID;
		showBackButton: boolean;
	}>(), {
		showBackButton: false
	});

	const isDeleting = ref(false);
	const showEditDialog = ref(false);

	const marker = computed(() => client.markers[props.markerId]);

	function move(): void {
		moveMarker(props.markerId, client, mapContext, toasts);
	}

	async function deleteMarker(): Promise<void> {
		toasts.hideToast(`fm${context.id}-marker-info-delete`);

		if (!marker.value || !await showConfirm({ title: "Remove marker", message: `Do you really want to remove the marker “${marker.value.name}”?` }))
			return;

		isDeleting.value = true;

		try {
			await client.deleteMarker({ id: props.markerId });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-marker-info-delete`, "Error deleting marker", err);
		} finally {
			isDeleting.value = false;
		}
	}

	function zoomToMarker(): void {
		if (marker.value)
			flyTo(mapContext.components.map, getZoomDestinationForMarker(marker.value));
	}

	function useAs(event: "route-set-from" | "route-add-via" | "route-set-to"): void {
		if (!marker.value)
			return;

		const markerSuggestion: FindOnMapResult = { ...marker.value, kind: "marker", similarity: 1 };
		mapContext.emit(event, {
			query: normalizeMarkerName(marker.value.name),
			mapSuggestions: [markerSuggestion],
			selectedSuggestion: markerSuggestion
		});
		mapContext.emit("search-box-show-tab", { id: `fm${context.id}-route-form-tab` });
	}

	function useAsFrom(): void {
		useAs("route-set-from");
	}

	function useAsVia(): void {
		useAs("route-add-via");
	}

	function useAsTo(): void {
		useAs("route-set-to");
	}
</script>

<template>
	<div class="fm-marker-info" v-if="marker">
		<h2>
			<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{normalizeMarkerName(marker.name)}}
		</h2>
		<dl class="fm-search-box-collapse-point">
			<dt class="pos">Coordinates</dt>
			<dd class="pos"><Coordinates :point="marker"></Coordinates></dd>

			<template v-if="marker.ele != null">
				<dt class="elevation">Elevation</dt>
				<dd class="elevation">{{marker.ele}} m</dd>
			</template>

			<template v-for="field in client.types[marker.typeId].fields" :key="field.name">
				<dt>{{field.name}}</dt>
				<dd v-html="formatField(field, marker.data[field.name])"></dd>
			</template>
		</dl>

		<div class="btn-group">
			<button
				type="button"
				class="btn btn-secondary btn-sm"
				v-tooltip="'Zoom to marker'"
				@click="zoomToMarker()"
			>
				<Icon icon="zoom-in" alt="Zoom to marker"></Icon>
			</button>

			<div v-if="context.search" class="dropdown">
				<button type="button" class="btn btn-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown">Use as</button>
				<ul class="dropdown-menu">
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="useAsFrom()"
						>Route start</a>
					</li>

					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="useAsVia()"
						>Route via</a>
					</li>

					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="useAsTo()"
						>Route destination</a>
					</li>
				</ul>
			</div>

			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-secondary btn-sm"
				@click="showEditDialog = true"
				:disabled="isDeleting || mapContext.interaction"
			>Edit data</button>
			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-secondary btn-sm"
				@click="move()"
				:disabled="isDeleting || mapContext.interaction"
			>Move</button>
			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-secondary btn-sm"
				@click="deleteMarker()"
				:disabled="isDeleting || mapContext.interaction"
			>
				<div v-if="isDeleting" class="spinner-border spinner-border-sm"></div>
				Remove
			</button>
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
	}
</style>