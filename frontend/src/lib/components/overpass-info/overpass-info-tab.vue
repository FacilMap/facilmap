<script setup lang="ts">
	import type { OverpassElement } from "facilmap-leaflet";
	import OverpassMultipleInfo from "./overpass-multiple-info.vue";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { useEventListener } from "../../utils/utils";
	import { computed } from "vue";
	import { injectContextRequired, requireMapContext, requireSearchBoxContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { formatPOIName } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const searchBoxContext = requireSearchBoxContext(context);
	const i18n = useI18n();

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const elements = computed(() => {
		return mapContext.value.selection.flatMap((item) => (item.type == "overpass" ? [item.element] : []));
	});

	function handleOpenSelection(): void {
		if (elements.value.length > 0)
			searchBoxContext.value.activateTab(`fm${context.id}-overpass-info-tab`, { expand: true });
	}

	function handleElementClick(element: OverpassElement, toggle: boolean): void {
		if (toggle)
			mapContext.value.components.selectionHandler.setSelectedItems(mapContext.value.selection.filter((it) => it.type != "overpass" || it.element !== element), true);
		else
			mapContext.value.components.selectionHandler.setSelectedItems(mapContext.value.selection.filter((it) => it.type == "overpass" && it.element === element), true);
	}

	function close(): void {
		mapContext.value.components.selectionHandler.setSelectedItems([]);
	}
</script>

<template>
	<template v-if="elements.length > 0">
		<SearchBoxTab
			:id="`fm${context.id}-overpass-info-tab`"
			:title="elements.length == 1 ? (formatPOIName(elements[0].tags.name)) : i18n.t('overpass-info-tab.tab-label', { count: elements.length })"
			isCloseable
			@close="close()"
		>
			<OverpassMultipleInfo :elements="elements" @click-element="handleElementClick"></OverpassMultipleInfo>
		</SearchBoxTab>
	</template>
</template>