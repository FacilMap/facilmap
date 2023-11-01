<script setup lang="ts">
	import { FindOnMapResult, SearchResult, Type } from "facilmap-types";
	import Icon from "../ui/icon.vue";
	import SearchResultInfo from "../search-result-info.vue";
	import { SelectedItem } from "../../utils/selection";
	import { FileResult, FileResultObject } from "../../utils/files";
	import { addSearchResultsToMap } from "./utils";
	import { isFileResult, isLineResult, isMapResult, isMarkerResult } from "../../utils/search";
	import { combineZoomDestinations, flyTo, getZoomDestinationForMapResult, getZoomDestinationForResults, getZoomDestinationForSearchResult } from "../../utils/zoom";
	import vTooltip from "../../utils/tooltip";
	import { vScrollIntoView } from "../../utils/vue";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";
	import { computed, ref, watch } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import CustomImportDialog from "./custom-import-dialog.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();
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

	const activeTab = ref(0);
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
			...(props.searchResults || []).filter((result) => mapContext.selection.some((item) => item.type == "searchResult" && item.result === result)),
			...(props.mapResults || []).filter((result) => {
				if (result.kind == "marker")
					return mapContext.selection.some((item) => item.type == "marker" && item.id == result.id);
				else if (result.kind == "line")
					return mapContext.selection.some((item) => item.type == "line" && item.id == result.id);
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
		return Object.values(client.types).filter((type) => type.type == "marker");
	});

	const lineTypes = computed(() => {
		return Object.values(client.types).filter((type) => type.type == "line");
	});

	const hasCustomTypes = computed(() => {
		return Object.keys(props.customTypes).length > 0;
	});

	function closeResult(): void {
		activeTab.value = 0;
	}

	watch(openResult, () => {
		if (!openResult.value && activeTab.value != 0)
			activeTab.value = 0;
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
			dest = combineZoomDestinations([dest, { bounds: mapContext.components.map.getBounds() }]);
		if (dest)
			flyTo(mapContext.components.map, dest);
	}

	function zoomToResult(result: SearchResult | FileResult | FindOnMapResult): void {
		const dest = isMapResult(result) ? getZoomDestinationForMapResult(result) : getZoomDestinationForSearchResult(result);
		if (dest)
			flyTo(mapContext.components.map, dest);
	}

	function handleOpen(result: SearchResult | FileResult | FindOnMapResult, event: MouseEvent): void {
		selectResult(result, false);

		setTimeout(async () => {
			if (isMapResult(result)) {
				if (result.kind == "marker" && !client.markers[result.id])
					await client.getMarker({ id: result.id });
				mapContext.emit("search-box-show-tab", { id: `fm${context.id}-${result.kind}-info-tab`, expand: false });
			} else
				activeTab.value = 1;
		}, 0);
	}

	function selectResult(result: SearchResult | FileResult | FindOnMapResult, toggle: boolean): void {
		const item: SelectedItem = isMapResult(result) ? { type: result.kind, id: result.id } : { type: "searchResult", result, layerId: props.layerId };
		if (toggle)
			mapContext.components.selectionHandler.toggleItem(item);
		else
			mapContext.components.selectionHandler.setSelectedItems([item]);
	}

	function toggleSelectAll(): void {
		if (!props.searchResults)
			return;

		if (isAllSelected.value)
			mapContext.components.selectionHandler.setSelectedItems([]);
		else {
			mapContext.components.selectionHandler.setSelectedItems(props.searchResults.map((result) => ({ type: "searchResult", result, layerId: props.layerId })));

			if (props.autoZoom)
				zoomToSelectedResults(true);
		}
	}

	async function addToMap(results: Array<SearchResult | FileResult>, type: Type): Promise<void> {
		toasts.hideToast(`fm${context.id}-search-result-info-add-error`);
		isAdding.value = true;

		try {
			const selection = await addSearchResultsToMap(results.map((result) => ({ result, type })), client);
			mapContext.components.selectionHandler.setSelectedItems(selection, true);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-search-result-info-add-error`, "Error adding to map", err);
		} finally {
			isAdding.value = false;
		}
	}

	function useAs(result: SearchResult | FileResult, event: "route-set-from" | "route-add-via" | "route-set-to"): void {
		if (isFileResult(result))
			mapContext.emit(event, { query: `${result.lat},${result.lon}` });
		else
			mapContext.emit(event, {
				query: result.short_name,
				searchSuggestions: props.searchResults,
				mapSuggestions: props.mapResults,
				selectedSuggestion: result
			});
		mapContext.emit("search-box-show-tab", { id: `fm${context.id}-route-form-tab` });
	}

	function useAsFrom(result: SearchResult | FileResult): void {
		useAs(result, "route-set-from");
	}

	function useAsVia(result: SearchResult | FileResult): void {
		useAs(result, "route-add-via");
	}

	function useAsTo(result: SearchResult | FileResult): void {
		useAs(result, "route-set-to");
	}
</script>

<template>
	<div class="fm-search-results" :class="{ isNarrow: context.isNarrow }">
		<b-carousel :interval="0" v-model="activeTab">
			<b-carousel-slide>
				<div v-if="(!searchResults || searchResults.length == 0) && (!mapResults || mapResults.length == 0)" class="alert alert-danger">No results have been found.</div>

				<div class="fm-search-box-collapse-point">
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
				</div>

				<div v-if="client.padData && !client.readonly && searchResults && searchResults.length > 0" class="btn-group">
					<button
						type="button"
						class="btn btn-light"
						:class="{ active: isAllSelected }"
						@click="toggleSelectAll"
					>Select all</button>

					<div v-if="client.padData && !client.readonly" class="dropdown">
						<button type="button" class="btn btn-light dropdown-toggle" :disabled="activeSearchResults.length == 0 || isAdding">
							<div v-if="isAdding" class="spinner-border spinner-border-sm"></div>
							Add selected item{{activeSearchResults.length == 1 ? '' : 's'}} to map
						</button>
						<ul class="dropdown-menu">
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
						</ul>
					</div>
				</div>
			</b-carousel-slide>

			<b-carousel-slide>
				<SearchResultInfo
					v-if="openResult"
					:result="openResult"
					show-back-button
					:is-adding="isAdding"
					@back="closeResult()"
					@add-to-map="addToMap([openResult], $event)"
					@use-as-from="useAsFrom(openResult)"
					@use-as-via="useAsVia(openResult)"
					@use-as-to="useAsTo(openResult)"
				></SearchResultInfo>
			</b-carousel-slide>
		</b-carousel>

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
		&, .carousel, .carousel-inner, .carousel-item.active, .carousel-item-prev, .carousel-item-next, .carousel-caption {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.carousel-item {
			float: none;
		}

		.carousel-inner {
			flex-direction: row;
		}

		.list-group-item {
			display: flex;
			align-items: center;

			> :first-child {
				flex-grow: 1;
			}
		}

		.list-group-item.active a {
			color: inherit;
		}

		.carousel-caption {
			position: static;
			padding: 0;
			color: inherit;
			text-align: inherit;
		}

		.fm-search-box-collapse-point {
			min-height: 3em;
		}

		.btn-toolbar {
			margin-top: 0.5rem;
		}
	}
</style>