<script setup lang="ts">
	import { renderOsmTag } from "facilmap-utils";
	import Icon from "../ui/icon.vue";
	import { getZoomDestinationForMarker } from "../../utils/zoom";
	import type { OverpassElement } from "facilmap-leaflet";
	import Coordinates from "../ui/coordinates.vue";
	import { computed } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import type { Type } from "facilmap-types";
	import UseAsDropdown from "../ui/use-as-dropdown.vue";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
import type { RouteDestination } from "../facil-map-context-provider/map-context";

	const context = injectContextRequired();
	const client = requireClientContext(context);

	const props = withDefaults(defineProps<{
		element: OverpassElement;
		showBackButton?: boolean;
		isAdding?: boolean;
	}>(), {
		showBackButton: false,
		isAdding: false
	});

	const emit = defineEmits<{
		back: [];
		"add-to-map": [type: Type];
	}>();

	const types = computed(() => {
		return Object.values(client.value.types).filter((type) => type.type == "marker");
	});

	const zoomDestination = computed(() => getZoomDestinationForMarker(props.element));

	const routeDestination = computed<RouteDestination>(() => {
		return {
			query: `${props.element.lat},${props.element.lon}`
		};
	});
</script>

<template>
	<div class="fm-overpass-info">
		<h2>
			<a v-if="showBackButton" href="javascript:" @click="emit('back')"><Icon icon="arrow-left"></Icon></a>
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

		<div class="btn-toolbar">
			<ZoomToObjectButton
				label="POI"
				size="sm"
				:destination="zoomDestination"
			></ZoomToObjectButton>

			<DropdownMenu
				v-if="!client.readonly && types.length > 0"
				size="sm"
				:isBusy="isAdding"
				label="Add to map"
			>
				<template v-for="type in types" :key="type.id">
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="emit('add-to-map', type)"
						>{{type.name}}</a>
					</li>
				</template>
			</DropdownMenu>

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