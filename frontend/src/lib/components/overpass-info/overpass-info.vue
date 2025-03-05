<script setup lang="ts">
	import { formatCoordinates, formatPOIName, renderOsmTag } from "facilmap-utils";
	import Icon from "../ui/icon.vue";
	import { getZoomDestinationForMarker } from "../../utils/zoom";
	import type { OverpassElement } from "facilmap-leaflet";
	import Coordinates from "../ui/coordinates.vue";
	import { computed } from "vue";
	import type { Type } from "facilmap-types";
	import UseAsDropdown from "../ui/use-as-dropdown.vue";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import type { RouteDestination } from "../facil-map-context-provider/route-form-tab-context";
	import { overpassElementsToMarkersWithTags } from "../../utils/add";
	import AddToMapDropdown from "../ui/add-to-map-dropdown.vue";
	import { useI18n } from "../../utils/i18n";

	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		element: OverpassElement;
		showBackButton?: boolean;
		isAdding?: boolean;
		zoom?: number;
	}>(), {
		showBackButton: false,
		isAdding: false
	});

	const emit = defineEmits<{
		back: [];
		"add-to-map": [type: Type];
	}>();

	const zoomDestination = computed(() => getZoomDestinationForMarker(props.element));

	const routeDestination = computed<RouteDestination>(() => {
		return {
			query: formatCoordinates(props.element)
		};
	});

	const markersWithTags = computed(() => overpassElementsToMarkersWithTags([props.element]));
</script>

<template>
	<div class="fm-overpass-info">
		<h2>
			<a v-if="showBackButton" href="javascript:" @click="emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{formatPOIName(element.tags.name)}}
		</h2>
		<dl class="fm-search-box-collapse-point fm-search-box-dl">
			<dt>{{i18n.t("common.coordinates")}}</dt>
			<dd><Coordinates :point="element" :zoom="props.zoom"></Coordinates></dd>

			<template v-for="(value, key) in element.tags" :key="key">
				<dt>{{key}}</dt>
				<dd v-html="renderOsmTag(key, value)"></dd>
			</template>
		</dl>

		<div class="btn-toolbar">
			<ZoomToObjectButton
				:label="i18n.t('overpass-info.zoom-to-object-label')"
				size="sm"
				:destination="zoomDestination"
			></ZoomToObjectButton>

			<AddToMapDropdown
				:markers="markersWithTags"
				size="sm"
				isSingle
			></AddToMapDropdown>

			<UseAsDropdown
				size="sm"
				:isDisabled="isAdding"
				:destination="routeDestination"
			></UseAsDropdown>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-overpass-info {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.fm-search-box-collapse-point {
			min-height: 1.5em;
		}
	}
</style>