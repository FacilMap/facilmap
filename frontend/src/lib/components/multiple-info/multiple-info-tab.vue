<script setup lang="ts">
	import MultipleInfo from "./multiple-info.vue";
	import { Line, Marker } from "facilmap-types";
	import { isLine, isMarker, useEventListener } from "../../utils/utils";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";
	import { computed } from "vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const objects = computed(() => {
		const objects = mapContext.selection.flatMap((item): Array<Marker | Line> => {
			if (item.type == "marker" && client.markers[item.id])
				return [client.markers[item.id]];
			else if (item.type == "line" && client.lines[item.id])
				return [client.lines[item.id]];
			else
				return [];
		});
		return objects.length > 1 ? objects : undefined;
	});

	function handleOpenSelection(): void {
		if (objects.value)
			mapContext.emit("search-box-show-tab", { id: `fm${context.id}-multiple-info-tab` });
	}

	const title = computed(() => objects.value ? `${objects.value.length} objects` : "");

	function handleObjectClick(object: Marker | Line, event: MouseEvent): void {
		const item = mapContext.selection.find((it) => {
			return (it.type == "marker" && isMarker(object) && it.id == object.id) || (it.type == "line" && isLine(object) && it.id == object.id);
		});
		if (item) {
			if (event.ctrlKey)
				mapContext.components.selectionHandler.setSelectedItems(mapContext.selection.filter((it) => it !== item), true);
			else
				mapContext.components.selectionHandler.setSelectedItems([item], true);
		}
	}

	function close(): void {
		mapContext.components.selectionHandler.setSelectedItems([]);
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