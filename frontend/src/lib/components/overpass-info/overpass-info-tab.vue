<script setup lang="ts">
	import type { OverpassElement } from "facilmap-leaflet";
	import OverpassMultipleInfo from "./overpass-multiple-info.vue";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { useEventListener } from "../../utils/utils";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";
	import { injectContextRequired } from "../../utils/context";
	import { computed } from "vue";

	const context = injectContextRequired();
	const mapContext = injectMapContextRequired();

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const elements = computed(() => {
		return mapContext.selection.flatMap((item) => (item.type == "overpass" ? [item.element] : []));
	});

	function handleOpenSelection(): void {
		if (elements.value.length > 0)
			mapContext.emit("search-box-show-tab", { id: `fm${context.id}-overpass-info-tab` });
	}

	function handleElementClick(element: OverpassElement, event: MouseEvent): void {
		if (event.ctrlKey)
			mapContext.components.selectionHandler.setSelectedItems(mapContext.selection.filter((it) => it.type != "overpass" || it.element !== element), true);
		else
			mapContext.components.selectionHandler.setSelectedItems(mapContext.selection.filter((it) => it.type == "overpass" && it.element === element), true);
	}

	function close(): void {
		mapContext.components.selectionHandler.setSelectedItems([]);
	}
</script>

<template>
	<template v-if="elements.length > 0">
		<SearchBoxTab
			:id="`fm${context.id}-overpass-info-tab`"
			:title="elements.length == 1 ? (elements[0].tags.name || 'Unnamed POI') : `${elements.length} POIs`"
			isCloseable
			@close="close()"
		>
			<OverpassMultipleInfo :elements="elements" @click-element="handleElementClick"></OverpassMultipleInfo>
		</SearchBoxTab>
	</template>
</template>