<script setup lang="ts">
	import { renderOsmTag } from "facilmap-utils";
	import Icon from "../ui/icon.vue";
	import { flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
	import { OverpassElement } from "facilmap-leaflet";
	import Coordinates from "../ui/coordinates.vue";
	import vTooltip from "../../utils/tooltip";
	import { computed } from "vue";
	import { injectClientRequired } from "../client-context.vue";
	import { injectContextRequired } from "../../utils/context";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	const props = withDefaults(defineProps<{
		element: OverpassElement;
		showBackButton?: boolean;
		isAdding?: boolean;
	}>(), {
		showBackButton: false,
		isAdding: false
	});

	const types = computed(() => {
		return Object.values(client.types).filter((type) => type.type == "marker");
	});

	function zoomToElement(): void {
		const dest = getZoomDestinationForMarker(props.element);
		if (dest)
			flyTo(mapContext.components.map, dest);
	}

	function useAs(event: "route-set-from" | "route-add-via" | "route-set-to"): void {
		mapContext.emit(event, { query: `${props.element.lat},${props.element.lon}` });
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
	<div class="fm-overpass-info">
		<h2>
			<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{element.tags.name || 'Unnamed POI'}}
		</h2>
		<dl class="fm-search-box-collapse-point">
			<dt>Coordinates</dt>
			<dd><Coordinates :point="element"></Coordinates></dd>

			<template v-for="(value, key) in element.tags" :key="key">
				<dt>{{key}}</dt>
				<dd v-html="renderOsmTag(key, value)"></dd>
			</template>
		</dl>

		<div class="btn-group">
			<button
				type="button"
				class="btn btn-light btn-sm"
				v-tooltip.hover="'Zoom to POI'"
				@click="zoomToElement()"
			>
				<Icon icon="zoom-in" alt="Zoom to POI"></Icon>
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

			<div v-if="context.search" class="dropdown">
				<button type="button" class="btn btn-light btn-sm dropdown-toggle" :disabled="isAdding">Use as</button>
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