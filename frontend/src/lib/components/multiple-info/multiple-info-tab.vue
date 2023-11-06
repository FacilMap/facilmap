<script setup lang="ts">
	import MultipleInfo from "./multiple-info.vue";
	import type { Line, Marker } from "facilmap-types";
	import { isLine, isMarker, useEventListener } from "../../utils/utils";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { computed } from "vue";
	import { injectContextRequired, requireClientContext, requireMapContext, requireSearchBoxContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const searchBoxContext = requireSearchBoxContext(context);

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const objects = computed(() => {
		const objects = mapContext.value.selection.flatMap((item): Array<Marker | Line> => {
			if (item.type == "marker" && client.value.markers[item.id])
				return [client.value.markers[item.id]];
			else if (item.type == "line" && client.value.lines[item.id])
				return [client.value.lines[item.id]];
			else
				return [];
		});
		return objects.length > 1 ? objects : undefined;
	});

	function handleOpenSelection(): void {
		if (objects.value)
			searchBoxContext.value.activateTab(`fm${context.id}-multiple-info-tab`);
	}

	const title = computed(() => objects.value ? `${objects.value.length} objects` : "");

	function handleObjectClick(object: Marker | Line, event: MouseEvent): void {
		const item = mapContext.value.selection.find((it) => {
			return (it.type == "marker" && isMarker(object) && it.id == object.id) || (it.type == "line" && isLine(object) && it.id == object.id);
		});
		if (item) {
			if (event.ctrlKey)
				mapContext.value.components.selectionHandler.setSelectedItems(mapContext.value.selection.filter((it) => it !== item), true);
			else
				mapContext.value.components.selectionHandler.setSelectedItems([item], true);
		}
	}

	function close(): void {
		mapContext.value.components.selectionHandler.setSelectedItems([]);
	}
</script>

<template>
	<template v-if="objects">
		<SearchBoxTab
			:id="`fm${context.id}-multiple-info-tab`"
			:title="title"
			isCloseable
			@close="close()"
		>
			<MultipleInfo :objects="objects" @click-object="handleObjectClick"></MultipleInfo>
		</SearchBoxTab>
	</template>
</template>