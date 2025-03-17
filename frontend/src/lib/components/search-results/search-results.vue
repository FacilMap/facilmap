<script setup lang="ts">
	import type { FindOnMapResult, SearchResult } from "facilmap-types";
	import SearchResultInfo from "../search-result-info.vue";
	import type { SelectedItem } from "../../utils/selection";
	import type { FileResult, FileResultObject } from "../../utils/files";
	import { isFileResult, isLineResult, isMapResult, isMarkerResult } from "../../utils/search";
	import { searchResultsToLinesWithTags, searchResultsToMarkersWithTags } from "../../utils/add";
	import { combineZoomDestinations, flyTo, getZoomDestinationForMapResult, getZoomDestinationForResults, getZoomDestinationForSearchResult } from "../../utils/zoom";
	import { computed, ref, toRef } from "vue";
	import CustomImportDialog from "./custom-import-dialog.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import AddToMapDropdown from "../ui/add-to-map-dropdown.vue";
	import { formatTypeName, normalizeLineName, normalizeMarkerName } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";
	import type { ResultsItem } from "../ui/results.vue";
	import Results from "../ui/results.vue";
	import SelectionCarousel from "../ui/selection-carousel.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const searchBoxContext = toRef(() => context.components.searchBox);
	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		searchResults?: Array<SearchResult | FileResult>;
		mapResults?: FindOnMapResult[];
		layerId: number;
		/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
		unionZoom?: boolean;
		/** When clicking or selecting a search result, zoom to it. */
		autoZoom?: boolean;
		customTypes?: FileResultObject["types"];
	}>(), {
		unionZoom: false,
		autoZoom: false,
		customTypes: () => ({})
	});

	const customImport = ref(false);

	const activeResults = computed(() => {
		return [
			...(props.searchResults || []).filter((result) => mapContext.value.selection.some((item) => item.type == "searchResult" && item.result === result)),
			...(props.mapResults || []).filter((result) => {
				if (result.kind == "marker")
					return mapContext.value.selection.some((item) => item.type == "marker" && item.id == result.id);
				else if (result.kind == "line")
					return mapContext.value.selection.some((item) => item.type == "line" && item.id == result.id);
				else
					return false;
			})
		];
	});

	const isAllSelected = computed(() => {
		return !props.searchResults?.some((result) => !activeResults.value.includes(result));
	});

	const activeSearchResults = computed(() => {
		return activeResults.value.filter((result) => !isMapResult(result)) as Array<SearchResult | FileResult>;
	});

	const activeMarkerSearchResults = computed(() => {
		return activeSearchResults.value.filter((result) => isMarkerResult(result)) as Array<SearchResult | FileResult>;
	});

	const activeLineSearchResults = computed(() => {
		return activeSearchResults.value.filter((result) => isLineResult(result)) as Array<SearchResult | FileResult>;
	});

	const activeFileResults = computed(() => {
		return activeResults.value.filter((result): result is FileResult => isFileResult(result));
	});

	const hasCustomTypes = computed(() => {
		return Object.keys(props.customTypes).length > 0;
	});

	const mapResultItems = computed(() => (props.mapResults ?? []).map((result, i): ResultsItem<FindOnMapResult> => ({
		key: i,
		object: result,
		label: isMarkerResult(result) ? normalizeMarkerName(result.name) : normalizeLineName(result.name),
		labelSuffix: formatTypeName(client.value.types[result.typeId].name),
		zoomDestination: getZoomDestinationForMapResult(result),
		zoomTooltip: i18n.t('search-results.zoom-to-result-tooltip'),
		canOpen: true,
		openTooltip: i18n.t('search-results.show-details-tooltip')
	})));

	const searchResultItems = computed(() => (props.searchResults ?? []).map((result, i): ResultsItem<SearchResult | FileResult> => ({
		key: i,
		object: result,
		label: result.display_name,
		labelSuffix: result.type,
		zoomDestination: getZoomDestinationForSearchResult(result),
		zoomTooltip: i18n.t('search-results.zoom-to-result-tooltip'),
		canOpen: true,
		openTooltip: i18n.t('search-results.show-details-tooltip')
	})));

	function zoomToSelectedResults(unionZoom: boolean): void {
		let dest = getZoomDestinationForResults(activeResults.value);
		if (dest && unionZoom)
			dest = combineZoomDestinations([dest, { bounds: mapContext.value.components.map.getBounds() }]);
		if (dest)
			flyTo(mapContext.value.components.map, dest);
	}

	function handleOpen(
		result: SearchResult | FileResult | FindOnMapResult,
		open: (item: Extract<SelectedItem, { type: 'searchResult' }>) => void
	): void {
		if (isMapResult(result)) {
			selectResult(result, false);
			setTimeout(async () => {
				if (result.kind == "marker" && !client.value.markers[result.id])
					await client.value.getMarker({ id: result.id });
				searchBoxContext.value?.activateTab(`fm${context.id}-${result.kind}-info-tab`);
			}, 0);
		} else {
			open({ type: "searchResult", result, layerId: props.layerId });
		}
	}

	function selectResult(result: SearchResult | FileResult | FindOnMapResult, toggle: boolean): void {
		const item: SelectedItem = isMapResult(result) ? { type: result.kind, id: result.id } : { type: "searchResult", result, layerId: props.layerId };
		if (toggle)
			mapContext.value.components.selectionHandler.toggleItem(item);
		else
			mapContext.value.components.selectionHandler.setSelectedItems([item]);
	}

	function toggleSelectAll(): void {
		if (!props.searchResults)
			return;

		if (isAllSelected.value)
			mapContext.value.components.selectionHandler.setSelectedItems([]);
		else {
			mapContext.value.components.selectionHandler.setSelectedItems(props.searchResults.map((result) => ({ type: "searchResult", result, layerId: props.layerId })));

			if (props.autoZoom)
				zoomToSelectedResults(true);
		}
	}

	const activeMarkersWithTags = computed(() => searchResultsToMarkersWithTags(activeMarkerSearchResults.value));
	const activeLinesWithTags = computed(() => searchResultsToLinesWithTags(activeLineSearchResults.value));
</script>

<template>
	<div class="fm-search-results" :class="{ isNarrow: context.isNarrow }">
		<SelectionCarousel :selector="(item): item is Extract<SelectedItem, { type: 'searchResult' }> => item.type == 'searchResult'">
			<template #default="openResult">
				<div class="fm-search-box-collapse-point">
					<slot name="before"></slot>

					<div
						v-if="(!searchResults || searchResults.length == 0) && (mapResultItems.length == 0)"
						class="alert alert-danger"
					>
						{{i18n.t("search-results.no-results")}}
					</div>

					<Results
						v-if="mapResultItems.length > 0"
						:items="mapResultItems"
						:active="activeResults"
						:autoZoom="props.autoZoom"
						:unionZoom="props.unionZoom"
						@select="(result, toggle) => selectResult(result, toggle)"
						@open="(result) => handleOpen(result, (item) => openResult.open(item))"
					></Results>

					<hr v-if="mapResultItems.length > 0 && searchResultItems.length > 0"/>

					<Results
						v-if="searchResultItems.length > 0"
						:items="searchResultItems"
						:active="activeResults"
						:autoZoom="props.autoZoom"
						:unionZoom="props.unionZoom"
						@select="(result, toggle) => selectResult(result, toggle)"
						@open="(result) => handleOpen(result, (item) => openResult.open(item))"
					></Results>

					<slot name="after"></slot>
				</div>

				<div v-if="client.mapData && !client.readonly && searchResults && searchResults.length > 0" class="btn-toolbar mt-2">
					<button
						type="button"
						class="btn btn-secondary btn-sm"
						:class="{ active: isAllSelected }"
						@click="toggleSelectAll"
					>{{i18n.t("search-results.select-all")}}</button>

					<AddToMapDropdown
						:label="i18n.t('search-results.add-to-map-label', { count: activeSearchResults.length })"
						:markers="activeMarkersWithTags"
						:lines="activeLinesWithTags"
						size="sm"
					>
						<template v-if="hasCustomTypes" #after>
							<li><hr class="dropdown-divider"></li>
							<li>
								<a
									href="javascript:"
									class="dropdown-item"
									@click="customImport = true"
								>{{i18n.t("search-results.custom-type-mapping")}}</a>
							</li>
						</template>
					</AddToMapDropdown>
				</div>
			</template>

			<template #openItem="openResult">
				<SearchResultInfo
					:result="openResult.item.result"
					showBackButton
					:searchResults="props.searchResults"
					:mapResults="props.mapResults"
					:zoom="mapContext.zoom"
					@back="openResult.close()"
				></SearchResultInfo>
			</template>
		</SelectionCarousel>

		<CustomImportDialog
			v-if="customImport"
			:customTypes="props.customTypes"
			:results="activeFileResults"
			@hidden="customImport = false"
		></CustomImportDialog>
	</div>
</template>

<style lang="scss">
	.fm-search-results.fm-search-results {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>