<script setup lang="ts">
	import SearchForm from "./search-form.vue";
	import { Util } from "leaflet";
	import type { HashQuery } from "facilmap-leaflet";
	import { readonly, ref, toRef } from "vue";
	import { useEventListener } from "../../utils/utils";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { injectContextRequired, requireMapContext, requireSearchBoxContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import type { WritableSearchFormTabContext } from "../facil-map-context-provider/search-form-tab-context";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const searchBoxContext = requireSearchBoxContext(context);
	const i18n = useI18n();

	const searchForm = ref<InstanceType<typeof SearchForm>>();

	const hashQuery = ref<HashQuery | undefined>(undefined);

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	function handleOpenSelection(): void {
		const layerId = Util.stamp(mapContext.value.components.searchResultsLayer);
		if (mapContext.value.selection.some((item) => item.type == "searchResult" && item.layerId == layerId))
			searchBoxContext.value.activateTab(`fm${context.id}-search-form-tab`, { expand: true });
	}

	const searchFormTabContext: WritableSearchFormTabContext = {
		setQuery(query, zoom = false, smooth = true, autofocus = false): { zoomed: Promise<void>; loaded: Promise<void> } {
			searchForm.value!.setSearchString(query);
			searchBoxContext.value.activateTab(`fm${context.id}-search-form-tab`, { expand: !!query, autofocus });
			return searchForm.value!.search(zoom, undefined, smooth);
		}
	};

	context.provideComponent("searchFormTab", toRef(readonly(searchFormTabContext)));
</script>

<template>
	<SearchBoxTab
		:id="`fm${context.id}-search-form-tab`"
		:title="i18n.t('search-form-tab.tab-label')"
		:hashQuery="hashQuery"
		class="fm-search-form-tab"
	>
		<template #default="slotProps">
			<SearchForm :active="slotProps.isActive" ref="searchForm" @hash-query-change="hashQuery = $event"></SearchForm>
		</template>
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