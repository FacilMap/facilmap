<script setup lang="ts">
	import { computed, watch } from "vue";
	import MarkerInfo from "./marker-info.vue";
	import SearchBoxTab from "../search-box/search-box-tab.vue"
	import { useEventListener } from "../../utils/utils";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const markerId = computed(() => {
		if (mapContext.selection.length == 1 && mapContext.selection[0].type == "marker")
			return mapContext.selection[0].id;
		else
			return undefined;
	});

	const marker = computed(() => markerId.value != null ? client.markers[markerId.value] : undefined);

	watch(marker, () => {
		if (!marker.value && markerId.value != null)
			close();
	});

	function handleOpenSelection(): void {
		if (marker.value)
			mapContext.emit("search-box-show-tab", { id: `fm${context.id}-marker-info-tab` });
	}

	function close(): void {
		mapContext.components.selectionHandler.setSelectedItems([]);
	}
</script>

<template>
	<template v-if="markerId">
		<SearchBoxTab
			:id="`fm${context.id}-marker-info-tab`"
			:title="marker?.name ?? ''"
			isCloseable
			@close="close()"
		>
			<MarkerInfo :markerId="markerId"></MarkerInfo>
		</SearchBoxTab>
	</template>
</template>