<script setup lang="ts">
	import type { SearchResult } from "facilmap-types";
	import { find, formatCoordinates, getCurrentLanguage, getElevationForPoint, getFallbackLonLatResult } from "facilmap-utils";
	import { SearchResultsLayer } from "facilmap-leaflet";
	import SearchResultInfo from "./search-result-info.vue";
	import { Util } from "leaflet";
	import { computed, markRaw, nextTick, reactive, readonly, ref, toRef, watch, type Raw } from "vue";
	import { useEventListener } from "../utils/utils";
	import SearchBoxTab from "./search-box/search-box-tab.vue"
	import { injectContextRequired, requireMapContext, requireSearchBoxContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import type { WritableClickMarkerTabContext } from "./facil-map-context-provider/click-marker-tab-context";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import { isLanguageExplicit, useI18n } from "../utils/i18n";

	const toasts = useToasts();
	const i18n = useI18n();

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const searchBoxContext = requireSearchBoxContext(context);

	type Tab = {
		id: number;
		result: SearchResult;
		layer: Raw<SearchResultsLayer>;
		isLoading: boolean;
	};

	const tabs = ref<Tab[]>([]);

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const layerIds = computed(() => tabs.value.map((tab) => Util.stamp(tab.layer)));

	watch(() => mapContext.value.selection, () => {
		for (let i = tabs.value.length - 1; i >= 0; i--) {
			if (!mapContext.value.selection.some((item) => item.type == "searchResult" && item.layerId == layerIds.value[i]))
				close(tabs.value[i]);
		}
	});

	let idCounter = 1;

	const clickMarkerTabContext = ref<WritableClickMarkerTabContext>({
		async openClickMarker(point) {
			const result = reactive(getFallbackLonLatResult({ lat: point.lat, lon: point.lon, zoom: mapContext.value.zoom }));

			const layer = markRaw(new SearchResultsLayer([result]).addTo(mapContext.value.components.map));
			mapContext.value.components.selectionHandler.addSearchResultLayer(layer);

			const tab = reactive<Tab>({
				id: idCounter++,
				result,
				layer,
				isLoading: true
			});

			tabs.value.push(tab);

			mapContext.value.components.selectionHandler.setSelectedItems([{ type: "searchResult", result, layerId: Util.stamp(layer) }]);

			await nextTick();
			searchBoxContext.value.activateTab(`fm${context.id}-click-marker-tab-${tabs.value.length - 1}`, { expand: true });

			(async () => {
				const results = await mapContext.value.runOperation(async () => (
					await find(`geo:${formatCoordinates(point)}?z=${mapContext.value.zoom}`, {
						lang: isLanguageExplicit() ? getCurrentLanguage() : undefined
					})
				));

				if (results.length > 0) {
					tab.result = { ...results[0], elevation: tab.result.elevation };
				}

				tab.isLoading = false;
			})().catch((err) => {
				toasts.showErrorToast(`find-error-${tab.id}`, () => i18n.t("click-marker-tab.look-up-error"), err);
			});

			(async () => {
				const elevation = await getElevationForPoint(point);
				if (elevation != null) {
					tab.result.elevation = elevation;
				}
			})().catch((err) => {
				console.warn("Error fetching click marker elevation", err);
			});
		},

		closeLastClickMarker() {
			if (tabs.value.length > 0) {
				close(tabs.value[tabs.value.length - 1]);
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

	function close(tab: Tab): void {
		const idx = tabs.value.indexOf(tab);
		if (idx == -1)
			return;

		toasts.hideToast(`find-error-${tab.id}`);
		mapContext.value.components.selectionHandler.removeSearchResultLayer(tab.layer);
		tab.layer.remove();
		tabs.value.splice(idx, 1);
	}
</script>

<template>
	<template v-for="(tab, idx) in tabs" :key="tab.id">
		<SearchBoxTab
			:id="`fm${context.id}-click-marker-tab-${idx}`"
			:title="tab.result.short_name"
			isCloseable
			@close="close(tab)"
		>
			<SearchResultInfo :result="tab.result" :isLoading="tab.isLoading"></SearchResultInfo>
		</SearchBoxTab>
	</template>
</template>