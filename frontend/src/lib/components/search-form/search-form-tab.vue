<script setup lang="ts">
	import SearchForm from "./search-form.vue";
	import { Util } from "leaflet";
	import type { HashQuery } from "facilmap-leaflet";
	import { injectContextRequired } from "../../utils/context";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";
	import { ref } from "vue";
	import { useEventListener } from "../../utils/utils";
	import { injectSearchBoxContextRequired } from "../search-box/search-box-context.vue";
	import SearchBoxTab from "../search-box/search-box-tab.vue";

	const context = injectContextRequired();
	const mapContext = injectMapContextRequired();
	const searchBoxContext = injectSearchBoxContextRequired();

	const searchForm = ref<InstanceType<typeof SearchForm>>();

	const hashQuery = ref<HashQuery | undefined>(undefined);

	useEventListener(mapContext, "open-selection", handleOpenSelection);
	useEventListener(mapContext, "search-set-query", handleSetQuery);

	function handleOpenSelection(): void {
		const layerId = Util.stamp(mapContext.components.searchResultsLayer);
		if (mapContext.selection.some((item) => item.type == "searchResult" && item.layerId == layerId))
			searchBoxContext.activateTab(`fm${context.id}-search-form-tab`);
	}

	function handleSetQuery({ query, zoom = false, smooth = true }: { query: string; zoom?: boolean; smooth?: boolean }): void {
		searchForm.value!.setSearchString(query);
		searchForm.value!.search(zoom, undefined, smooth);
		searchBoxContext.activateTab(`fm${context.id}-search-form-tab`, !!query);
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