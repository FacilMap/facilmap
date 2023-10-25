<script setup lang="ts">
	import { LineCreate, MarkerCreate, Point, SearchResult, Type } from "facilmap-types";
	import { round } from "facilmap-utils";
	import { lineStringToTrackPoints, mapSearchResultToType } from "./search-results/utils";
	import { hideToast, showErrorToast } from "./ui/toasts/toasts.vue";
	import { SearchResultsLayer } from "facilmap-leaflet";
	import SearchResultInfo from "./search-result-info.vue";
	import Icon from "./ui/icon.vue";
	import { Util } from "leaflet";
	import { injectContextRequired } from "../utils/context";
	import { injectClientRequired } from "./client-context.vue";
	import { computed, markRaw, ref, watch } from "vue";
	import { useEventListener } from "../utils/utils";
	import { injectMapContextRequired } from "./leaflet-map/leaflet-map.vue";
	import SearchBoxTab from "./search-box/search-box-tab.vue"

	const context = injectContextRequired();
	const mapContext = injectMapContextRequired();
	const client = injectClientRequired();

	let lastClick = 0;

	const activeResults = ref<SearchResult[]>([]);
	const layers = ref<SearchResultsLayer[]>([]);
	const isAdding = ref(false);

	useEventListener(mapContext, "map-long-click", handleMapLongClick);
	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const layerIds = computed(() => layers.value.map((layer) => Util.stamp(layer)));

	watch(() => mapContext.selection, () => {
		for (let i = activeResults.value.length - 1; i >= 0; i--) {
			if (!mapContext.selection.some((item) => item.type == "searchResult" && item.layerId == layerIds.value[i]))
				close(activeResults.value[i]);
		}
	});

	function handleOpenSelection(): void {
		for (let i = 0; i < layerIds.value.length; i++) {
			if (mapContext.selection.some((item) => item.type == "searchResult" && item.layerId == layerIds.value[i])) {
				mapContext.emit("search-box-show-tab", { id: `fm${context.id}-click-marker-tab-${i}` });
				break;
			}
		}
	}

	async function handleMapLongClick({ point }: { point: Point }): Promise<void> {
		const now = Date.now();
		lastClick = now;

		const results = await client.find({
			query: `geo:${round(point.lat, 5)},${round(point.lon, 5)}?z=${mapContext.zoom}`,
			loadUrls: false,
			elevation: true
		});

		if (now !== lastClick) {
			// There has been another click since the one we are reacting to.
			return;
		}

		if (results.length > 0) {
			const layer = new SearchResultsLayer([results[0]]).addTo(mapContext.components.map);
			mapContext.components.selectionHandler.addSearchResultLayer(layer);

			activeResults.value.push(results[0]);
			layers.value.push(markRaw(layer));

			mapContext.components.selectionHandler.setSelectedItems([{ type: "searchResult", result: results[0], layerId: Util.stamp(layer) }]);

			setTimeout(() => {
				mapContext.emit("search-box-show-tab", { id: `fm${context.id}-click-marker-tab-${activeResults.value.length - 1}` });
			}, 0);
		}
	}

	function close(result: SearchResult): void {
		const idx = activeResults.value.indexOf(result);
		if (idx == -1)
			return;

		mapContext.components.selectionHandler.removeSearchResultLayer(layers.value[idx]);
		layers.value[idx].remove();
		activeResults.value.splice(idx, 1);
		layers.value.splice(idx, 1);
	}

	function clear(): void {
		for (let i = activeResults.value.length - 1; i >= 0; i--)
			close(activeResults.value[i]);
	}

	async function addToMap(result: SearchResult, type: Type): Promise<void> {
		hideToast(`fm${context.id}-click-marker-add-error`);
		isAdding.value = true;

		try {
			const obj: Partial<MarkerCreate & LineCreate> = {
				name: result.short_name,
				data: mapSearchResultToType(result, type)
			};

			if(type.type == "marker") {
				const marker = await client.addMarker({
					...obj,
					lat: result.lat!,
					lon: result.lon!,
					typeId: type.id
				});

				mapContext.components.selectionHandler.setSelectedItems([{ type: "marker", id: marker.id }], true);
			} else if(type.type == "line") {
				const trackPoints = lineStringToTrackPoints(result.geojson as any);
				const line = await client.addLine({
					...obj,
					typeId: type.id,
					routePoints: [trackPoints[0], trackPoints[trackPoints.length-1]],
					trackPoints: trackPoints,
					mode: "track"
				});

				mapContext.components.selectionHandler.setSelectedItems([{ type: "line", id: line.id }], true);
			}

			close(result);
		} catch (err) {
			showErrorToast(`fm${context.id}-click-marker-add-error`, "Error adding to map", err);
		} finally {
			isAdding.value = false;
		}
	}

	function useAs(result: SearchResult, event: "route-set-from" | "route-add-via" | "route-set-to"): void {
		mapContext.emit(event, { query: result.short_name, searchSuggestions: [result], selectedSuggestion: result });
		mapContext.emit("search-box-show-tab", { id: `fm${context.id}-route-form-tab` });
	}

	function useAsFrom(result: SearchResult): void {
		useAs(result, "route-set-from");
	}

	function useAsVia(result: SearchResult): void {
		useAs(result, "route-add-via");
	}

	function useAsTo(result: SearchResult): void {
		useAs(result, "route-set-to");
	}
</script>

<template>
	<template v-for="(result, idx) in activeResults">
		<SearchBoxTab
			:id="`fm${context.id}-click-marker-tab-${idx}`"
			:title="result.short_name"
			isCloseable
			@close="close(result)"
		>
			<SearchResultInfo
				:result="result"
				:is-adding="isAdding"
				@add-to-map="addToMap(result, $event)"
				@use-as-from="useAsFrom(result)"
				@use-as-via="useAsVia(result)"
				@use-as-to="useAsTo(result)"
			></SearchResultInfo>
		</SearchBoxTab>
	</template>
</template>