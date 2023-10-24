<script setup lang="ts">
	import Icon from "../ui/icon.vue";
	import { isSearchId } from "facilmap-utils";
	import { hideToast, showErrorToast } from "../ui/toasts/toasts.vue";
	import { FindOnMapResult, SearchResult } from "facilmap-types";
	import SearchResults from "../search-results/search-results.vue";
	import { flyTo, getZoomDestinationForMapResult, getZoomDestinationForResults, getZoomDestinationForSearchResult, normalizeZoomDestination, openSpecialQuery } from "../../utils/zoom";
	import { Util } from "leaflet";
	import { isMapResult } from "../../utils/search";
	import storage from "../../utils/storage";
	import { HashQuery } from "facilmap-leaflet";
	import { FileResultObject, parseFiles } from "../../utils/files";
	import FileResults from "../file-results.vue";
	import { injectContextRequired } from "../../utils/context";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";
	import { computed, ref, watch } from "vue";
	import { injectClientRequired } from "../client-context.vue";

	const emit = defineEmits<{
		(type: "hash-query-change", query: HashQuery | undefined): void;
	}>();

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	const autofocus = ref(!context.isNarrow && context.autofocus);
	const layerId = Util.stamp(mapContext.components.searchResultsLayer);

	const searchInput = ref<HTMLInputElement>();

	const searchString = ref("");
	const loadingSearchString = ref("");
	const loadedSearchString = ref("");
	const searchCounter = ref(0);

	const searchResults = ref<SearchResult[]>();
	const mapResults = ref<FindOnMapResult[]>();
	const fileResult = ref<FileResultObject>();

	const zoomDestination = computed(() => getZoomDestinationForResults([
		...(searchResults.value || []),
		...(mapResults.value || []),
		...(fileResult.value?.features || [])
	]));

	const hashQuery = computed(() => {
		if (loadedSearchString.value) {
			return {
				query: loadedSearchString.value,
				...(zoomDestination.value && normalizeZoomDestination(mapContext.components.map, zoomDestination.value)),
				description: `Search for ${loadedSearchString.value}`
			};
		} else if (loadingSearchString.value)
			return { query: loadingSearchString.value, description: `Search for ${loadedSearchString.value}` };
		else
			return undefined;
	});

	watch(hashQuery, (hashQuery: HashQuery | undefined) => {
		emit("hash-query-change", hashQuery);
	});

	function setSearchString(query: string) {
		searchString.value = query;
	}

	function handleSubmit(): void {
		searchInput.value?.blur();

		search(storage.autoZoom, storage.zoomToAll);
	}

	async function search(zoom: boolean, zoomToAll?: boolean, smooth = true): Promise<void> {
		if (searchString.value != loadedSearchString.value) {
			reset();

			const counter = ++searchCounter.value;

			if(searchString.value.trim() != "") {
				try {
					if (await openSpecialQuery(searchString.value, context, client, mapContext, zoom)) {
						searchString.value = "";
						return;
					}

					const query = searchString.value;
					loadingSearchString.value = searchString.value;

					const [newSearchResults, newMapResults] = await Promise.all([
						client.find({ query, loadUrls: true, elevation: true }),
						client.padData ? client.findOnMap({ query }) : undefined
					]);

					if (counter != searchCounter.value)
						return; // Another search has been started in the meantime

					loadingSearchString.value = "";
					loadedSearchString.value = query;

					if(isSearchId(query) && Array.isArray(newSearchResults) && newSearchResults.length > 0 && newSearchResults[0].display_name) {
						searchString.value = newSearchResults[0].display_name;
						loadedSearchString.value = query;
					}

					if(typeof newSearchResults == "string") {
						searchResults.value = undefined;
						mapResults.value = undefined;
						fileResult.value = parseFiles([ newSearchResults ]);
						mapContext.components.searchResultsLayer.setResults(fileResult.value.features);
					} else {
						searchResults.value = newSearchResults;
						mapContext.components.searchResultsLayer.setResults(newSearchResults);
						mapResults.value = newMapResults ?? undefined;
						fileResult.value = undefined;
					}
				} catch(err) {
					showErrorToast(`fm${context.id}-search-form-error`, "Search error", err);
					return;
				}
			}
		}

		if (zoomToAll || (zoomToAll == null && (searchResults.value?.length ?? 0) + (mapResults.value?.length ?? 0) > 1)) {
			if (zoom)
				zoomToAllResults(smooth);
		} else if (mapResults.value && mapResults.value.length > 0 && (mapResults.value[0].similarity == 1 || (!searchResults.value || searchResults.value.length == 0))) {
			mapContext.components.selectionHandler.setSelectedItems([{ type: mapResults.value[0].kind, id: mapResults.value[0].id }])
			if (zoom)
				zoomToResult(mapResults.value[0], smooth);
		} else if (searchResults.value && searchResults.value.length > 0) {
			mapContext.components.selectionHandler.setSelectedItems([{ type: "searchResult", result: searchResults.value[0], layerId }]);
			if (zoom)
				zoomToResult(searchResults.value[0], smooth);
		} else if (fileResult.value) {
			if (zoom)
				zoomToAllResults(smooth);
		}
	}

	function reset(): void {
		searchCounter.value++;

		mapContext.components.selectionHandler.setSelectedItems(mapContext.selection.filter((item) => item.type != "searchResult" || item.layerId != this.layerId));
		hideToast(`fm${context.id}-search-form-error`);
		loadingSearchString.value = "";
		loadedSearchString.value = "";
		searchResults.value = undefined;
		mapResults.value = undefined;
		fileResult.value = undefined;
		mapContext.components.searchResultsLayer.setResults([]);
	};

	function zoomToResult(result: SearchResult | FindOnMapResult, smooth = true): void {
		const dest = isMapResult(result) ? getZoomDestinationForMapResult(result) : getZoomDestinationForSearchResult(result);
		if (dest)
			flyTo(mapContext.components.map, dest, smooth);
	}

	function zoomToAllResults(smooth = true): void {
		if (zoomDestination.value)
			flyTo(mapContext.components.map, zoomDestination.value, smooth);
	}

	defineExpose({
		setSearchString,
		search
	});
</script>

<template>
	<div class="fm-search-form">
		<form action="javascript:" @submit.prevent="handleSubmit()">
			<div class="input-group">
				<input type="search" class="form-control" v-model="searchString" :autofocus="autofocus" ref="searchInput" />
				<button
					type="submit"
					class="btn btn-light"
				>
					<Icon icon="search" alt="Search"></Icon>
				</button>
				<button
					v-if="searchResults || mapResults || fileResult"
					type="button"
					class="btn btn-light"
					@click="reset()"
				>
					<Icon icon="remove" alt="Clear"></Icon>
				</button>
				<div class="dropdown">
					<button type="button" class="btn btn-light dropdown-toggle"></button>
					<ul class="dropdown-menu">
						<li>
							<a
								href="javascript:"
								class="dropdown-item"
								@click.native.capture.stop.prevent="storage.autoZoom = !storage.autoZoom"
							>
								<Icon :icon="storage.autoZoom ? 'check' : 'unchecked'"></Icon> Auto-zoom to results
							</a>
						</li>

						<li>
							<a
								href="javascript:"
								class="dropdown-item"
								@click.native.capture.stop.prevent="storage.zoomToAll = !storage.zoomToAll"
							>
								<Icon :icon="storage.zoomToAll ? 'check' : 'unchecked'"></Icon> Zoom to all results
							</a>
						</li>
					</ul>
				</div>
			</div>
		</form>

		<FileResults
			v-if="fileResult"
			:file="fileResult"
			:auto-zoom="storage.autoZoom"
			:union-zoom="storage.zoomToAll"
			:layer-id="layerId"
		/>
		<SearchResults
			v-else-if="searchResults || mapResults"
			:search-results="searchResults"
			:map-results="mapResults"
			:auto-zoom="storage.autoZoom"
			:union-zoom="storage.zoomToAll"
			:layer-id="layerId"
		></SearchResults>
	</div>
</template>

<style lang="scss">
	.fm-search-form {
		display: flex;
		flex-direction: column;
		min-height: 0;

		fieldset {
			margin-bottom: 0;
		}

		.fm-search-results {
			margin-top: 1rem;
		}
	}
</style>