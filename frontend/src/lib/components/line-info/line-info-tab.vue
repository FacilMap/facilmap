<script setup lang="ts">
	import { computed, watch } from "vue";
	import LineInfo from "./line-info.vue";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { useEventListener } from "../../utils/utils";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const lineId = computed(() => {
		if (mapContext.selection.length == 1 && mapContext.selection[0].type == "line")
			return mapContext.selection[0].id;
		else
			return undefined;
	});

	const line = computed(() => {
		return lineId.value != null ? client.lines[lineId.value] : undefined;
	});

	watch(line, () => {
		if (!line.value && lineId.value != null) {
			close();
		}
	});

	const title = computed(() => {
		if (line.value != null)
			return line.value.name;
		else
			return undefined;
	});

	function handleOpenSelection(): void {
		if (line.value)
			mapContext.emit("search-box-show-tab", { id: `fm${context.id}-line-info-tab` })
	}

	function close(): void {
		mapContext.components.selectionHandler.setSelectedItems([]);
	}
</script>

<template>
	<template v-if="lineId">
		<SearchBoxTab
			:id="`fm${context.id}-line-info-tab`"
			:title="title ?? ''"
			isCloseable
			@close="close()"
		>
			<LineInfo :lineId="lineId"></LineInfo>
		</SearchBoxTab>
	</template>
</template>