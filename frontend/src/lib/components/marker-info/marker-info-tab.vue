<script setup lang="ts">
	import { computed, watch } from "vue";
	import MarkerInfo from "./marker-info.vue";
	import SearchBoxTab from "../search-box/search-box-tab.vue"
	import { useEventListener } from "../../utils/utils";
	import { injectContextRequired, getClientSub, requireMapContext, requireSearchBoxContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { normalizeMarkerName } from "facilmap-utils";

	const context = injectContextRequired();
	const clientSub = getClientSub(context);
	const mapContext = requireMapContext(context);
	const searchBoxContext = requireSearchBoxContext(context);

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const markerId = computed(() => {
		if (mapContext.value.selection.length == 1 && mapContext.value.selection[0].type == "marker")
			return mapContext.value.selection[0].id;
		else
			return undefined;
	});

	const marker = computed(() => markerId.value != null ? clientSub.value?.data.markers[markerId.value] : undefined);

	watch(marker, () => {
		if (!marker.value && markerId.value != null)
			close();
	});

	function handleOpenSelection(): void {
		if (marker.value)
			searchBoxContext.value.activateTab(`fm${context.id}-marker-info-tab`, { expand: true });
	}

	function close(): void {
		mapContext.value.components.selectionHandler.setSelectedItems([]);
	}
</script>

<template>
	<template v-if="markerId">
		<SearchBoxTab
			:id="`fm${context.id}-marker-info-tab`"
			:title="marker ? normalizeMarkerName(marker.name) : ''"
			isCloseable
			@close="close()"
		>
			<MarkerInfo :markerId="markerId" :zoom="mapContext.zoom"></MarkerInfo>
		</SearchBoxTab>
	</template>
</template>