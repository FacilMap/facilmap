<script setup lang="ts">
	import { renderOsmTag } from "facilmap-utils";
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

	const props = withDefaults(defineProps<{
		result: SearchResult | FileResult;
		showBackButton?: boolean;
		/** If specified, will be passed to the route form as suggestions when using the "Use as" menu */
		searchResults?: SearchResult[];
		/** If specified, will be passed to the route form as suggestions when using the "Use as" menu */
		mapResults?: FindOnMapResult[];
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
				return { query: `${props.result.lat},${props.result.lon}` };
			} else if (props.result.geojson?.type === "Point") {
				return { query: `${props.result.geojson.coordinates[1]},${props.result.geojson.coordinates[0]}` };
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
			<template v-if="result.type">
				<dt>Type</dt>
				<dd class="text-break">{{result.type}}</dd>
			</template>

			<template v-if="result.address">
				<dt>Address</dt>
				<dd class="text-break">{{result.address}}</dd>
			</template>

			<template v-if="result.type != 'coordinates' && result.lat != null && result.lon != null">
				<dt>Coordinates</dt>
				<dd><Coordinates :point="result as Point"></Coordinates></dd>
			</template>

			<template v-if="result.elevation != null">
				<dt>Elevation</dt>
				<dd>{{result.elevation}}&#x202F;m</dd>
			</template>

			<template v-for="(value, key) in result.extratags" :key="key">
				<dt>{{key}}</dt>
				<dd class="text-break" v-html="renderOsmTag(key, value)"></dd>
			</template>
		</dl>

		<div class="btn-toolbar">
			<ZoomToObjectButton
				v-if="zoomDestination"
				label="search result"
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