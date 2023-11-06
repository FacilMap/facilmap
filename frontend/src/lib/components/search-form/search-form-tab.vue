<script setup lang="ts">
	import SearchForm from "./search-form.vue";
	import { Util } from "leaflet";
	import type { HashQuery } from "facilmap-leaflet";
	import { ref } from "vue";
	import { useEventListener } from "../../utils/utils";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { injectContextRequired, requireMapContext, requireSearchBoxContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const searchBoxContext = requireSearchBoxContext(context);

	const searchForm = ref<InstanceType<typeof SearchForm>>();

	const hashQuery = ref<HashQuery | undefined>(undefined);

	useEventListener(mapContext, "open-selection", handleOpenSelection);
	useEventListener(mapContext, "search-set-query", handleSetQuery);

	function handleOpenSelection(): void {
		const layerId = Util.stamp(mapContext.value.components.searchResultsLayer);
		if (mapContext.value.selection.some((item) => item.type == "searchResult" && item.layerId == layerId))
			searchBoxContext.value.activateTab(`fm${context.id}-search-form-tab`);
	}

	function handleSetQuery({ query, zoom = false, smooth = true }: { query: string; zoom?: boolean; smooth?: boolean }): void {
		searchForm.value!.setSearchString(query);
		searchForm.value!.search(zoom, undefined, smooth);
		searchBoxContext.value.activateTab(`fm${context.id}-search-form-tab`, !!query);
	}
</script>

<template>
	<SearchBoxTab
		:id="`fm${context.id}-search-form-tab`"
		title="Search"
		:hashQuery="hashQuery"
		class="fm-search-form-tab"
	>
		<SearchForm ref="searchForm" @hash-query-change="hashQuery = $event"></SearchForm>
	</SearchBoxTab>
</template>

<style lang="scss">
	.fm-search-form-tab.fm-search-form-tab.fm-search-form-tab {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;

		.input-group {
			position: static;
		}
	}
</style>