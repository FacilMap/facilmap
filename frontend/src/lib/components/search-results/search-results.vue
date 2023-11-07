<script setup lang="ts">
	import type { FindOnMapResult, SearchResult, Type } from "facilmap-types";
	import Icon from "../ui/icon.vue";
	import SearchResultInfo from "../search-result-info.vue";
	import type { SelectedItem } from "../../utils/selection";
	import type { FileResult, FileResultObject } from "../../utils/files";
	import { addSearchResultsToMap } from "./utils";
	import { isFileResult, isLineResult, isMapResult, isMarkerResult } from "../../utils/search";
	import { combineZoomDestinations, flyTo, getZoomDestinationForMapResult, getZoomDestinationForResults, getZoomDestinationForSearchResult } from "../../utils/zoom";
	import vTooltip from "../../utils/tooltip";
	import { vScrollIntoView } from "../../utils/vue";
	import { computed, ref, toRef, watch } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import CustomImportDialog from "./custom-import-dialog.vue";
	import { useCarousel } from "../../utils/carousel";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const searchBoxContext = toRef(() => context.components.searchBox);
	const toasts = useToasts();

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

	const carouselRef = ref<HTMLElement>();
	const carousel = useCarousel(carouselRef);
	const isAdding = ref(false);
	const customImport = ref(false);

	const showZoom = computed(() => !props.autoZoom || props.unionZoom);

	const openResult = computed(() => {
		if (activeResults.value.length == 1 && !isMapResult(activeResults.value[0]))
			return activeResults.value[0];
		else
			return undefined;
	});

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
		return activeResults.value.filter(isFileResult);
	});

	const markerTypes = computed(() => {
		return Object.values(client.value.types).filter((type) => type.type == "marker");
	});

	const lineTypes = computed(() => {
		return Object.values(client.value.types).filter((type) => type.type == "line");
	});

	const hasCustomTypes = computed(() => {
		return Object.keys(props.customTypes).length > 0;
	});

	function closeResult(): void {
		carousel.setTab(0);
	}

	watch(openResult, () => {
		if (!openResult.value && carousel.tab != 0)
			carousel.setTab(0);
	});

	function handleClick(result: SearchResult | FileResult | FindOnMapResult, event: MouseEvent): void {
		const toggle = event.ctrlKey;
		selectResult(result, toggle);

		if (props.autoZoom)
			zoomToSelectedResults(props.unionZoom || toggle);
	}

	function zoomToSelectedResults(unionZoom: boolean): void {
		let dest = getZoomDestinationForResults(activeResults.value);
		if (dest && unionZoom)
			dest = combineZoomDestinations([dest, { bounds: mapContext.value.components.map.getBounds() }]);
		if (dest)
			flyTo(mapContext.value.components.map, dest);
	}

	function zoomToResult(result: SearchResult | FileResult | FindOnMapResult): void {
		const dest = isMapResult(result) ? getZoomDestinationForMapResult(result) : getZoomDestinationForSearchResult(result);
		if (dest)
			flyTo(mapContext.value.components.map, dest);
	}

	function handleOpen(result: SearchResult | FileResult | FindOnMapResult, event: MouseEvent): void {
		selectResult(result, false);

		setTimeout(async () => {
			if (isMapResult(result)) {
				if (result.kind == "marker" && !client.value.markers[result.id])
					await client.value.getMarker({ id: result.id });
				searchBoxContext.value?.activateTab(`fm${context.id}-${result.kind}-info-tab`, false);
			} else
				carousel.setTab(1);
		}, 0);
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

	async function addToMap(results: Array<SearchResult | FileResult>, type: Type): Promise<void> {
		toasts.hideToast(`fm${context.id}-search-result-info-add-error`);
		isAdding.value = true;

		try {
			const selection = await addSearchResultsToMap(results.map((result) => ({ result, type })), client);
			mapContext.value.components.selectionHandler.setSelectedItems(selection, true);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-search-result-info-add-error`, "Error adding to map", err);
		} finally {
			isAdding.value = false;
		}
	}
</script>

<template>
	<div class="fm-search-results" :class="{ isNarrow: context.isNarrow }">
		<div class="carousel slide" ref="carouselRef">
			<div class="carousel-item" :class="{ active: carousel.tab === 0 }">
				<div
					v-if="(!searchResults || searchResults.length == 0) && (!mapResults || mapResults.length == 0)"
					class="alert alert-danger"
				>
					No results have been found.
				</div>

				<slot name="before"></slot>

				<ul v-if="mapResults && mapResults.length > 0" class="list-group">
					<!-- eslint-disable-next-line vue/require-v-for-key -->
					<li
						v-for="result in mapResults"
						class="list-group-item"
						:class="{ active: activeResults.includes(result) }"
						v-scroll-into-view="activeResults.includes(result)"
					>
						<span>
							<a href="javascript:" @click="handleClick(result, $event)">{{result.name}}</a>
							{{" "}}
							<span class="result-type">({{client.types[result.typeId].name}})</span>
						</span>
						<a v-if="showZoom" href="javascript:" @click="zoomToResult(result)" v-tooltip.hover.left="'Zoom to result'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
						<a href="javascript:" @click="handleOpen(result, $event)" v-tooltip.left="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
					</li>
				</ul>

				<hr v-if="mapResults && mapResults.length > 0 && searchResults && searchResults.length > 0"/>

				<ul v-if="searchResults && searchResults.length > 0" class="list-group">
					<!-- eslint-disable-next-line vue/require-v-for-key -->
					<li
						v-for="result in searchResults"
						class="list-group-item"
						:class="{ active: activeResults.includes(result) }"
						v-scroll-into-view="activeResults.includes(result)"
					>
						<span>
							<a href="javascript:" @click="handleClick(result, $event)">{{result.display_name}}</a>
							{{" "}}
							<span class="result-type" v-if="result.type">({{result.type}})</span>
						</span>
						<a v-if="showZoom" href="javascript:" @click="zoomToResult(result)" v-tooltip.left="'Zoom to result'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
						<a href="javascript:" @click="handleOpen(result, $event)" v-tooltip.right="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
					</li>
				</ul>

				<slot name="after"></slot>

				<div v-if="client.padData && !client.readonly && searchResults && searchResults.length > 0" class="btn-toolbar">
					<button
						type="button"
						class="btn btn-secondary"
						:class="{ active: isAllSelected }"
						@click="toggleSelectAll"
					>Select all</button>

					<DropdownMenu
						v-if="client.padData && !client.readonly"
						:label="`Add selected item${activeSearchResults.length == 1 ? '' : 's'} to map`"
						:isDisabled="activeSearchResults.length == 0"
						:isBusy="isAdding"
					>
						<template v-if="activeMarkerSearchResults.length > 0 && markerTypes.length ">
							<template v-for="type in markerTypes" :key="type.id">
								<li>
									<a
										href="javascript:"
										class="dropdown-item"
										@click="addToMap(activeMarkerSearchResults, type)"
									>Marker items as {{type.name}}</a>
								</li>
							</template>
						</template>
						<template v-if="activeLineSearchResults.length > 0 && lineTypes.length ">
							<template v-for="type in lineTypes" :key="type.id">
								<li>
									<a
										href="javascript:"
										class="dropdown-item"
										@click="addToMap(activeLineSearchResults, type)"
									>Line/polygon items as {{type.name}}</a>
								</li>
							</template>
						</template>
						<template v-if="hasCustomTypes">
							<li><hr class="dropdown-divider"></li>
							<li>
								<a
									href="javascript:"
									class="dropdown-item"
									@click="customImport = true"
								>Custom type mapping…</a>
							</li>
						</template>
					</DropdownMenu>
				</div>
			</div>

			<div class="carousel-item" :class="{ active: carousel.tab === 1 }">
				<SearchResultInfo
					v-if="openResult"
					:result="openResult"
					showBackButton
					:isAdding="isAdding"
					:searchSuggestions="props.searchResults"
					:mapSuggestions="props.mapResults"
					@back="closeResult()"
					@add-to-map="addToMap([openResult], $event)"
				></SearchResultInfo>
			</div>
		</div>

		<CustomImportDialog
			v-if="customImport"
			:customType="props.customTypes"
			:results="activeFileResults"
			@hidden="customImport = false"
		></CustomImportDialog>
	</div>
</template>

<style lang="scss">
	.fm-search-results.fm-search-results {
		.list-group-item {
			display: flex;
			align-items: center;

			> :first-child {
				flex-grow: 1;
			}
		}
	}
</style>