<script setup lang="ts">
	import { computed, watch } from "vue";
	import LineInfo from "./line-info.vue";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { useEventListener } from "../../utils/utils";
	import { injectContextRequired, requireClientSub, requireMapContext, requireSearchBoxContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { normalizeLineName } from "facilmap-utils";

	const context = injectContextRequired();
	const clientSub = requireClientSub(context);
	const mapContext = requireMapContext(context);
	const searchBoxContext = requireSearchBoxContext(context);

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	const lineId = computed(() => {
		if (mapContext.value.selection.length == 1 && mapContext.value.selection[0].type == "line")
			return mapContext.value.selection[0].id;
		else
			return undefined;
	});

	const line = computed(() => {
		return lineId.value != null ? clientSub.value.data.lines[lineId.value] : undefined;
	});

	watch(line, () => {
		if (!line.value && lineId.value != null) {
			close();
		}
	});

	const title = computed(() => {
		if (line.value != null)
			return normalizeLineName(line.value.name);
		else
			return undefined;
	});

	function handleOpenSelection(): void {
		if (line.value)
			searchBoxContext.value.activateTab(`fm${context.id}-line-info-tab`, { expand: true })
	}

	function close(): void {
		mapContext.value.components.selectionHandler.setSelectedItems([]);
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