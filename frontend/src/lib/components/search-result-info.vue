<script setup lang="ts">
	import { renderOsmTag } from "facilmap-utils";
	import { Point, SearchResult } from "facilmap-types";
	import Icon from "./ui/icon.vue";
	import { FileResult } from "../utils/files";
	import { isLineResult, isMarkerResult } from "../utils/search";
	import { flyTo, getZoomDestinationForSearchResult } from "../utils/zoom";
	import Coordinates from "./ui/coordinates.vue";
	import vTooltip from "../utils/tooltip";
	import { computed } from "vue";
	import { injectContextRequired } from "../utils/context";
	import { injectClientRequired } from "./client-context.vue";
	import { injectMapContextRequired } from "./leaflet-map/leaflet-map.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	const props = withDefaults(defineProps<{
		result: SearchResult | FileResult;
		showBackButton?: boolean;
		isAdding?: boolean;
	}>(), {
		showBackButton: false,
		isAdding: false
	});

	const isMarker = computed(() => isMarkerResult(props.result));

	const isLine = computed(() => isLineResult(props.result));

	const types = computed(() => {
		// Result can be both marker and line
		return Object.values(client.types).filter((type) => (isMarker.value && type.type == "marker") || (isLine.value && type.type == "line"));
	});

	function zoomToResult(): void {
		const dest = getZoomDestinationForSearchResult(props.result);
		if (dest)
			flyTo(mapContext.components.map, dest);
	}
</script>

<template>
	<div class="fm-search-result-info" v-if="result">
		<h2>
			<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{result.short_name}}
		</h2>
		<dl class="fm-search-box-collapse-point">
			<template v-if="result.type">
				<dt>Type</dt>
				<dd>{{result.type}}</dd>
			</template>

			<template v-if="result.address">
				<dt>Address</dt>
				<dd>{{result.address}}</dd>
			</template>

			<template v-if="result.type != 'coordinates' && result.lat != null && result.lon != null">
				<dt>Coordinates</dt>
				<dd><Coordinates :point="result as Point"></Coordinates></dd>
			</template>

			<template v-if="result.elevation != null">
				<dt>Elevation</dt>
				<dd>{{result.elevation}} m</dd>
			</template>

			<template v-for="(value, key) in result.extratags" :key="key">
				<dt>{{key}}</dt>
				<dd v-html="renderOsmTag(key, value)"></dd>
			</template>
		</dl>

		<div class="btn-group" role="group">
			<button
				type="button"
				class="btn btn-light btn-sm"
				v-tooltip="'Zoom to search result'"
				@click="zoomToResult()"
			>
				<Icon icon="zoom-in" alt="Zoom to search result"></Icon>
			</button>

			<div v-if="!client.readonly && types.length > 0" class="dropdown">
				<button type="button" class="btn btn-light btn-sm dropdown-toggle" :disabled="isAdding">
					<div v-if="isAdding" class="spinner-border spinner-border-sm"></div>
					Add to map
				</button>
				<ul class="dropdown-menu">
					<template v-for="type in types" :key="type.id">
						<li>
							<a
								href="javascript:"
								class="dropdown-item"
								@click="$emit('add-to-map', type)"
							>{{type.name}}</a>
						</li>
					</template>
				</ul>
			</div>

			<div v-if="isMarker && context.search" class="dropdown">
				<button type="button" class="btn btn-light btn-sm dropdown-toggle">Use as</button>
				<ul class="dropdown-menu">
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="$emit('use-as-from')"
						>Route start</a>
					</li>

					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="$emit('use-as-via')"
						>Route via</a>
					</li>

					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="$emit('use-as-to')"
						>Route destination</a>
					</li>
				</ul>
			</div>
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