<script setup lang="ts">
	import Icon from "../ui/icon.vue";
	import { find, getCurrentLanguage, getElevationForPoint, isSearchId, parseUrlQuery, loadDirectUrlQuery, type AnalyzedChangeset, type OsmFeatureBlame, normalizeMapName, type AnalyzedOsmFeature } from "facilmap-utils";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import type { Bbox, FindOnMapResult, SearchResult } from "facilmap-types";
	import SearchResults from "../search-results/search-results.vue";
	import { flyTo, getZoomDestinationForBbox, getZoomDestinationForMapResult, getZoomDestinationForOsmFeature, getZoomDestinationForResults, getZoomDestinationForSearchResult, normalizeZoomDestination, openSpecialQuery, type ZoomDestination } from "../../utils/zoom";
	import { Util } from "leaflet";
	import { isMapResult } from "../../utils/search";
	import storage from "../../utils/storage";
	import type { HashQuery } from "facilmap-leaflet";
	import { type FileResultObject, parseFiles } from "../../utils/files";
	import FileResults from "../file-results.vue";
	import ChangesetResults from "../osm/changeset-results/changeset-results.vue";
	import { computed, reactive, ref, watch } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { getClientSub, injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { isLanguageExplicit, useI18n } from "../../utils/i18n";
	import { throttle } from "lodash-es";
	import BlameResults from "../osm/blame-results/blame-results.vue";
	import RelationResults from "../osm/relation-results/relation-results.vue";
	import OsmFeatureInfo from "../osm/osm-feature-info.vue";
	import { streamToString } from "json-stream-es";

	const props = defineProps<{
		active: boolean;
	}>();

	const emit = defineEmits<{
		"hash-query-change": [query: HashQuery | undefined];
	}>();

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = getClientSub(context);
	const mapContext = requireMapContext(context);

	const toasts = useToasts();
	const i18n = useI18n();

	const layerId = Util.stamp(mapContext.value.components.searchResultsLayer);

	const searchInput = ref<HTMLInputElement>();
	const mapOnly = ref(false);

	const searchString = ref("");
	const loadingSearchString = ref<string>();
	const loadingSearchProgress = ref<number>();
	let loadingSearchAbort: AbortController | undefined = undefined;
	const loadedSearchString = ref<string>();
	const loadedMapOnly = ref<boolean>();

	const result = ref<{
		type: "search";
		search: SearchResult[];
		map?: FindOnMapResult[];
	} | {
		type: "file";
		file: FileResultObject;
	} | {
		type: "osm";
		feature: AnalyzedOsmFeature;
	} | {
		type: "changeset";
		changeset: AnalyzedChangeset;
	} | {
		type: "blame";
		blame: OsmFeatureBlame;
	}>();
	const preloadedZoomDestination = ref<ZoomDestination>();

	const zoomDestination = computed(() => {
		if (preloadedZoomDestination.value) {
			return preloadedZoomDestination.value;
		} else if (result.value?.type === "search") {
			return getZoomDestinationForResults([
				...result.value.search,
				...result.value.map ?? []
			]);
		} else if (result.value?.type === "file") {
			return getZoomDestinationForResults(result.value.file.features);
		} else if (result.value?.type === "osm") {
			return getZoomDestinationForOsmFeature(result.value.feature);
		}
	});

	const hashQuery = computed(() => {
		if (loadedSearchString.value) {
			return {
				query: loadedSearchString.value,
				...(zoomDestination.value && normalizeZoomDestination(mapContext.value.components.map, zoomDestination.value)),
				description: i18n.t("search-form.search-description", { query: loadedSearchString.value })
			};
		} else if (loadingSearchString.value)
			return { query: loadingSearchString.value, description: i18n.t("search-form.search-description", { query: loadingSearchString.value }) };
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

		void search(storage.autoZoom, storage.zoomToAll);
	}

	function search(zoom: boolean, zoomToAll?: boolean, smooth = true): { zoomed: Promise<void>; loaded: Promise<void> } {
		let hasZoomed = false;
		let resolveZoomed: () => void;
		let rejectZoomed: (err: any) => void;
		const zoomed = new Promise<void>((resolve, reject) => {
			resolveZoomed = resolve;
			rejectZoomed = reject;
		});
		const loaded = (async () => {
			const resolvedMapOnly = mapOnly.value && !!client.value.mapData;
			if (searchString.value != loadedSearchString.value || resolvedMapOnly !== loadedMapOnly.value) {
				reset();

				if(searchString.value.trim() != "") {
					try {
						if (await openSpecialQuery(searchString.value, context, zoom)) {
							searchString.value = "";
							return;
						}

						const query = searchString.value;
						loadingSearchString.value = searchString.value;
						loadingSearchAbort = new AbortController();
						const signal = loadingSearchAbort.signal;

						const onProgress = throttle((p) => {
							if (!signal.aborted) {
								loadingSearchProgress.value = p * 100;
							}
						}, 200);
						const loadedUrl = !resolvedMapOnly && await mapContext.value.runOperation(async () => await loadDirectUrlQuery(query, {
							signal: loadingSearchAbort!.signal,
							onProgress,
							onBbox: (bbox: Bbox) => {
								if (!signal.aborted) {
									preloadedZoomDestination.value = getZoomDestinationForBbox(bbox);
									if (zoom) {
										zoomToAllResults(smooth);
									}
									resolveZoomed();
									hasZoomed = true;
								}
							}
						}));
						onProgress.flush();
						const url = parseUrlQuery(query);

						const [newSearchResults, newMapResults] = await Promise.all([
							loadedUrl ? loadedUrl :
							!resolvedMapOnly && url ? clientContext.value.client.findUrl(query) :
							!resolvedMapOnly ? mapContext.value.runOperation(async () => await find(query, {
								lang: isLanguageExplicit() ? getCurrentLanguage() : undefined
							})) :
							[],
							clientSub.value ? clientContext.value.client.findOnMap(clientSub.value.mapSlug, query) : undefined
						]);

						if (signal.aborted)
							return;

						loadingSearchString.value = undefined;
						loadingSearchProgress.value = undefined;
						loadingSearchAbort = undefined;
						loadedSearchString.value = query;
						loadedMapOnly.value = resolvedMapOnly;

						if(isSearchId(query) && Array.isArray(newSearchResults) && newSearchResults.length > 0 && newSearchResults[0].display_name) {
							searchString.value = newSearchResults[0].display_name;
							loadedSearchString.value = query;
						}

						if (typeof newSearchResults === "string" || "data" in newSearchResults) {
							// TODO: Pass signal
							const content = typeof newSearchResults === "string" ? newSearchResults : await streamToString(newSearchResults);
							if (signal.aborted)
								return; // Another search has been started in the meantime
							const parsed = await mapContext.value.runOperation(async () => await parseFiles([content]));
							if (signal.aborted)
								return; // Another search has been started in the meantime
							result.value = {
								type: "file",
								file: parsed
							};
							mapContext.value.components.searchResultsLayer.setResults(result.value.file.features);
						} else if ("type" in newSearchResults) {
							result.value = {
								type: "osm",
								feature: newSearchResults
							};
						} else if ("changeset" in newSearchResults) {
							result.value = {
								type: "changeset",
								changeset: newSearchResults
							};
							mapContext.value.components.changesetLayer.setChangeset(newSearchResults);
						} else if ("feature" in newSearchResults) {
							result.value = {
								type: "blame",
								blame: newSearchResults
							};
							mapContext.value.components.featureBlameLayer.setBlame(newSearchResults);
						} else {
							const reactiveResults = reactive(newSearchResults);
							result.value = {
								type: "search",
								search: reactiveResults,
								map: newMapResults ?? undefined
							};
							mapContext.value.components.searchResultsLayer.setResults(newSearchResults);

							const points = newSearchResults.filter((res) => (res.lon && res.lat));
							if(points.length > 0) {
								(async () => {
									const elevations = await Promise.all(points.map(async (point) => {
										return await getElevationForPoint({ lat: Number(point.lat), lon: Number(point.lon) });
									}));
									elevations.forEach((elevation, i) => {
										reactiveResults[i].elevation = elevation;
									});
								})().catch((err) => {
									console.warn("Error fetching search result elevations", err);
								});
							}
						}
					} catch(err: any) {
						if (err.name !== "AbortError") {
							toasts.showErrorToast(`fm${context.id}-search-form-error`, () => i18n.t("search-form.search-error"), err);
							loadingSearchProgress.value = undefined;
						}
						return;
					}
				}
			}

			if (!hasZoomed) {
				if (zoomToAll || (zoomToAll == null && result.value?.type === "search" && result.value.search.length + (result.value.map?.length ?? 0) > 1)) {
					if (zoom)
						zoomToAllResults(smooth);
				} else if (result.value?.type === "search" && result.value.map && result.value.map.length > 0 && (result.value.map[0].similarity == 1 || result.value.search.length === 0)) {
					mapContext.value.components.selectionHandler.setSelectedItems([{ type: result.value.map[0].kind, id: result.value.map[0].id }])
					if (zoom)
						zoomToResult(result.value.map[0], smooth);
				} else if (result.value?.type === "search" && result.value.search.length > 0) {
					mapContext.value.components.selectionHandler.setSelectedItems([{ type: "searchResult", result: result.value.search[0], layerId }]);
					if (zoom)
						zoomToResult(result.value.search[0], smooth);
				} else if (result.value && ["file", "relation", "changeset", "blame"].includes(result.value.type)) {
					if (zoom)
						zoomToAllResults(smooth);
				}
			}
		})();

		// Resolve/reject zoomed if it has not already been called
		loaded.then(resolveZoomed!).catch(rejectZoomed!);

		return { zoomed, loaded };
	}

	function reset(): void {
		loadingSearchAbort?.abort();

		mapContext.value.components.selectionHandler.setSelectedItems(mapContext.value.selection.filter((item) => item.type != "searchResult" || item.layerId != layerId));
		toasts.hideToast(`fm${context.id}-search-form-error`);
		loadingSearchString.value = undefined;
		loadingSearchProgress.value = undefined;
		loadingSearchAbort = undefined;
		loadedSearchString.value = undefined;
		loadedMapOnly.value = undefined;
		result.value = undefined;
		preloadedZoomDestination.value = undefined;
		mapContext.value.components.searchResultsLayer.setResults([]);
		mapContext.value.components.changesetLayer.setChangeset(undefined);
		mapContext.value.components.featureBlameLayer.setBlame(undefined);
	};

	function zoomToResult(result: SearchResult | FindOnMapResult, smooth = true): void {
		const dest = isMapResult(result) ? getZoomDestinationForMapResult(result) : getZoomDestinationForSearchResult(result);
		if (dest)
			flyTo(mapContext.value.components.map, dest, smooth);
	}

	function zoomToAllResults(smooth = true): void {
		if (zoomDestination.value)
			flyTo(mapContext.value.components.map, zoomDestination.value, smooth);
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
				<input type="search" class="form-control fm-autofocus" v-model="searchString" ref="searchInput" />
				<button
					type="submit"
					class="btn btn-secondary"
				>
					<Icon icon="search" :alt="i18n.t('search-form.search-alt')"></Icon>
				</button>
				<button
					v-if="loadingSearchString != null || result"
					type="button"
					class="btn btn-secondary"
					@click="reset()"
				>
					<Icon icon="remove" :alt="i18n.t('search-form.clear-alt')"></Icon>
				</button>
				<DropdownMenu noWrapper>
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click.capture.stop.prevent="storage.autoZoom = !storage.autoZoom"
						>
							<Icon :icon="storage.autoZoom ? 'check' : 'unchecked'"></Icon> {{i18n.t("search-form.auto-zoom")}}
						</a>
					</li>

					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click.capture.stop.prevent="storage.zoomToAll = !storage.zoomToAll"
						>
							<Icon :icon="storage.zoomToAll ? 'check' : 'unchecked'"></Icon> {{i18n.t("search-form.zoom-to-all")}}
						</a>
					</li>

					<template v-if="clientContext.mapData">
						<li><hr class="dropdown-divider"></li>

						<li>
							<a
								href="javascript:"
								class="dropdown-item"
								@click.capture.stop.prevent="mapOnly = !mapOnly"
							>
								<Icon :icon="mapOnly ? 'check' : 'unchecked'"></Icon> {{i18n.t("search-form.map-only", { mapName: normalizeMapName(client.mapData.name) })}}
							</a>
						</li>
					</template>
				</DropdownMenu>
			</div>
		</form>

		<div v-if="loadingSearchProgress != null" class="progress mt-2">
			<div
				class="progress-bar progress-bar-striped progress-bar-animated"
				role="progressbar"
				:aria-valuenow="Math.floor(loadingSearchProgress)"
				aria-valuemin="0"
				aria-valuemax="100"
				:style="{ width: `${loadingSearchProgress}%` }"
			>
				{{Math.floor(loadingSearchProgress)}}&#x202f;%
			</div>
		</div>

		<template v-if="result?.type === 'search'">
			<SearchResults
				:search-results="result.search"
				:map-results="result.map"
				:auto-zoom="storage.autoZoom"
				:union-zoom="storage.zoomToAll"
				:layer-id="layerId"
			></SearchResults>
		</template>
		<template v-else-if="result?.type === 'file'">
			<FileResults
				:file="result.file"
				:auto-zoom="storage.autoZoom"
				:union-zoom="storage.zoomToAll"
				:layer-id="layerId"
			/>
		</template>
		<template v-else-if="result?.type === 'osm'">
			<hr />
			<template v-if="result.feature.type === 'relation'">
				<RelationResults
					:active="props.active"
					:relation="result.feature"
					:autoZoom="storage.autoZoom"
					:unionZoom="storage.zoomToAll"
				></RelationResults>
			</template>
			<template v-else>
				<OsmFeatureInfo
					:active="props.active"
					:feature="result.feature"
					:autoZoom="storage.autoZoom"
					:unionZoom="storage.zoomToAll"
					:zoom="mapContext.zoom"
				></OsmFeatureInfo>
			</template>
		</template>
		<template v-else-if="result?.type === 'changeset'">
			<hr />
			<ChangesetResults
				:changeset="result.changeset"
				:auto-zoom="storage.autoZoom"
				:union-zoom="storage.zoomToAll"
			/>
		</template>
		<template v-else-if="result?.type === 'blame'">
			<hr />
			<BlameResults
				:blame="result.blame"
				:auto-zoom="storage.autoZoom"
				:union-zoom="storage.zoomToAll"
			/>
		</template>
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
			margin-top: 0.5rem;
		}

		.fm-search-box-collapse-point {
			// Set min-height to one list group item
			min-height: calc(/* line-height */ 1.5rem + /* list-group-item padding */ 2 * 7px + /* list-group-item border */ 2 * 1px);
		}

		.progress {
			height: 1.5rem;
		}
	}
</style>