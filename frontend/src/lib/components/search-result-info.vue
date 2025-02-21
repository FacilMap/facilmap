<script setup lang="ts">
	import { formatCoordinates, renderOsmTag } from "facilmap-utils";
	import type { FindOnMapResult, Point, SearchResult, Type } from "facilmap-types";
	import Icon from "./ui/icon.vue";
	import type { FileResult } from "../utils/files";
	import { isFileResult, isMarkerResult } from "../utils/search";
	import { searchResultsToLinesWithTags, searchResultsToMarkersWithTags } from "../utils/add";
	import { getZoomDestinationForSearchResult } from "../utils/zoom";
	import Coordinates from "./ui/coordinates.vue";
	import { computed } from "vue";
	import UseAsDropdown from "./ui/use-as-dropdown.vue";
	import ZoomToObjectButton from "./ui/zoom-to-object-button.vue";
	import type { RouteDestination } from "./facil-map-context-provider/route-form-tab-context";
	import AddToMapDropdown from "./ui/add-to-map-dropdown.vue";
	import { useI18n } from "../utils/i18n";

	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		result: SearchResult | FileResult;
		showBackButton?: boolean;
		/** If specified, will be passed to the route form as suggestions when using the "Use as" menu */
		searchResults?: SearchResult[];
		/** If specified, will be passed to the route form as suggestions when using the "Use as" menu */
		mapResults?: FindOnMapResult[];
		isLoading?: boolean;
		zoom?: number;
	}>(), {
		showBackButton: false
	});

	const emit = defineEmits<{
		back: [];
		"add-to-map": [type: Type];
	}>();

	const isMarker = computed(() => isMarkerResult(props.result));

	const zoomDestination = computed(() => getZoomDestinationForSearchResult(props.result));

	const routeDestination = computed<RouteDestination | undefined>(() => {
		if (isFileResult(props.result)) {
			if (props.result.lat != null && props.result.lon != null) {
				return { query: formatCoordinates({ lat: props.result.lat, lon: props.result.lon }) };
			} else if (props.result.geojson?.type === "Point") {
				return { query: formatCoordinates({ lat: props.result.geojson.coordinates[1], lon: props.result.geojson.coordinates[0] }) };
			} else {
				return undefined;
			}
		} else {
			return {
				query: props.result.short_name,
				searchSuggestions: (props.searchResults || props.mapResults) ? props.searchResults : [props.result],
				mapSuggestions: props.mapResults,
				selectedSuggestion: props.result
			};
		}
	});

	const markersWithTags = computed(() => searchResultsToMarkersWithTags([props.result]));
	const linesWithTags = computed(() => searchResultsToLinesWithTags([props.result]));
</script>

<template>
	<div class="fm-search-result-info" v-if="result">
		<h2 class="text-break">
			<a v-if="showBackButton" href="javascript:" @click="emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{result.short_name}}
		</h2>
		<dl class="fm-search-box-collapse-point fm-search-box-dl">
			<template v-if="result.lat != null && result.lon != null">
				<dt class="pos">{{i18n.t("search-result-info.coordinates")}}</dt>
				<dd class="pos"><Coordinates :point="result as Point" :ele="result.elevation" :zoom="props.zoom"></Coordinates></dd>
			</template>

			<template v-if="result.type">
				<dt>{{i18n.t("search-result-info.type")}}</dt>
				<dd class="text-break">{{result.type}}</dd>
			</template>

			<template v-if="result.address">
				<dt>{{i18n.t("search-result-info.address")}}</dt>
				<dd class="text-break">{{result.address}}</dd>
			</template>

			<template v-for="(value, key) in result.extratags" :key="key">
				<dt>{{key}}</dt>
				<dd class="text-break" v-html="renderOsmTag(key, value)"></dd>
			</template>
		</dl>

		<template v-if="props.isLoading">
			<div class="d-flex justify-content-center mb-3">
				<div class="spinner-border"></div>
			</div>
		</template>

		<div class="btn-toolbar">
			<ZoomToObjectButton
				v-if="zoomDestination"
				:label="i18n.t('search-result-info.zoom-to-result-label')"
				size="sm"
				:destination="zoomDestination"
			></ZoomToObjectButton>

			<AddToMapDropdown
				:markers="markersWithTags"
				:lines="linesWithTags"
				size="sm"
				isSingle
			></AddToMapDropdown>

			<UseAsDropdown
				v-if="isMarker && routeDestination"
				size="sm"
				:destination="routeDestination"
			></UseAsDropdown>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-search-result-info {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.fm-search-box-collapse-point {
			min-height: 1.5em;
		}
	}
</style>