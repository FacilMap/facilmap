<script setup lang="ts">
	import type { SearchResult } from "facilmap-types";
	import { round } from "facilmap-utils";
	import { SearchResultsLayer } from "facilmap-leaflet";
	import SearchResultInfo from "./search-result-info.vue";
	import { Util } from "leaflet";
	import { computed, markRaw, nextTick, readonly, ref, shallowReactive, toRef, watch } from "vue";
	import { useEventListener } from "../utils/utils";
	import SearchBoxTab from "./search-box/search-box-tab.vue"
	import { injectContextRequired, requireClientContext, requireMapContext, requireSearchBoxContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import type { WritableClickMarkerTabContext } from "./facil-map-context-provider/click-marker-tab-context";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const client = requireClientContext(context);
	const searchBoxContext = requireSearchBoxContext(context);

	let lastClick = 0;

	const activeResults = ref<SearchResult[]>([]);
	const layers = shallowReactive<SearchResultsLayer[]>([]);

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const layerIds = computed(() => layers.map((layer) => Util.stamp(layer)));

	watch(() => mapContext.value.selection, () => {
		for (let i = activeResults.value.length - 1; i >= 0; i--) {
			if (!mapContext.value.selection.some((item) => item.type == "searchResult" && item.layerId == layerIds.value[i]))
				close(activeResults.value[i]);
		}
	});

	const clickMarkerTabContext = ref<WritableClickMarkerTabContext>({
		async openClickMarker(point) {
			const now = Date.now();
			lastClick = now;

			const results = await client.value.find({
				query: `geo:${round(point.lat, 5)},${round(point.lon, 5)}?z=${mapContext.value.zoom}`,
				loadUrls: false,
				elevation: true
			});

			if (now !== lastClick) {
				// There has been another click since the one we are reacting to.
				return;
			}

			if (results.length > 0) {
				const layer = new SearchResultsLayer([results[0]]).addTo(mapContext.value.components.map);
				mapContext.value.components.selectionHandler.addSearchResultLayer(layer);

				activeResults.value.push(results[0]);
				layers.push(markRaw(layer));

				mapContext.value.components.selectionHandler.setSelectedItems([{ type: "searchResult", result: results[0], layerId: Util.stamp(layer) }]);

				await nextTick();
				searchBoxContext.value.activateTab(`fm${context.id}-click-marker-tab-${activeResults.value.length - 1}`, { expand: true });
			}
		}
	});

	context.provideComponent("clickMarkerTab", toRef(readonly(clickMarkerTabContext)));

	function handleOpenSelection(): void {
		for (let i = 0; i < layerIds.value.length; i++) {
			if (mapContext.value.selection.some((item) => item.type == "searchResult" && item.layerId == layerIds.value[i])) {
				searchBoxContext.value.activateTab(`fm${context.id}-click-marker-tab-${i}`, { expand: true });
				break;
			}
		}
	}

	function close(result: SearchResult): void {
		const idx = activeResults.value.indexOf(result);
		if (idx == -1)
			return;

		mapContext.value.components.selectionHandler.removeSearchResultLayer(layers[idx]);
		layers[idx].remove();
		activeResults.value.splice(idx, 1);
		layers.splice(idx, 1);
	}
</script>

<template>
	<template v-for="(result, idx) in activeResults" :key="result.id">
		<SearchBoxTab
			:id="`fm${context.id}-click-marker-tab-${idx}`"
			:title="result.short_name"
			isCloseable
			@close="close(result)"
		>
			<SearchResultInfo :result="result"></SearchResultInfo>
		</SearchBoxTab>
	</template>
</template>