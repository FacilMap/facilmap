<script setup lang="ts">
	import { type FileResultObject, parseFiles } from "../utils/files";
	import pluralize from "pluralize";
	import { SearchResultsLayer } from "facilmap-leaflet";
	import { Util } from "leaflet";
	import FileResults from "./file-results.vue";
	import SearchBoxTab from "./search-box/search-box-tab.vue";
	import { computed, markRaw, readonly, ref, shallowReactive, toRef } from "vue";
	import { useDomEventListener, useEventListener } from "../utils/utils";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import { injectContextRequired, requireMapContext, requireSearchBoxContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import type { WritableImportTabContext } from "./facil-map-context-provider/import-tab-context";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const searchBoxContext = requireSearchBoxContext(context);
	const toasts = useToasts();

	const fileInputRef = ref<HTMLInputElement>();

	const files = ref<Array<FileResultObject & { title: string }>>([]);
	const layers = shallowReactive<SearchResultsLayer[]>([]);

	useEventListener(mapContext, "open-selection", handleOpenSelection);

	useDomEventListener(mapContext.value.components.container, "dragenter", handleMapDragEnter);
	useDomEventListener(mapContext.value.components.container, "dragover", handleMapDragOver);
	useDomEventListener(mapContext.value.components.container, "drop", handleMapDrop);

	const layerIds = computed(() => layers.map((layer) => Util.stamp(layer)));

	const importTabContext = ref<WritableImportTabContext>({
		openFilePicker() {
			fileInputRef.value?.click();
		}
	});

	context.provideComponent("importTab", toRef(readonly(importTabContext)));

	function handleOpenSelection(): void {
		for (let i = 0; i < layerIds.value.length; i++) {
			if (mapContext.value.selection.some((item) => item.type == "searchResult" && item.layerId == layerIds.value[i])) {
				searchBoxContext.value.activateTab(`fm${context.id}-import-tab-${i}`, { expand: true });
				break;
			}
		}
	}

	function handleMapDragEnter(event: Event): void {
		event.preventDefault();
	}

	function handleMapDragOver(event: Event): void {
		event.preventDefault();
	}

	function handleMapDrop(event: Event): void {
		event.preventDefault();

		void importFiles((event as DragEvent).dataTransfer?.files);
	}

	async function importFiles(fileList: FileList | undefined): Promise<void> {
		toasts.hideToast(`fm${context.id}-import-error`);

		if(!fileList || fileList.length == 0)
			return;

		try {
			const loadedFiles = await Promise.all([...fileList].map((file) => new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					resolve(reader.result as string);
				};
				reader.onerror = () => {
					reject(reader.error);
				};
				reader.readAsText(file);
			})));

			const result = {
				...await parseFiles(loadedFiles),
				title: (fileList.length == 1 && fileList[0].name) || pluralize("file", fileList.length, true)
			};
			const hasAnyItems = result.features.length > 0 || Object.keys(result.types).length > 0 || Object.keys(result.views).length > 0;
			if (!hasAnyItems && result.errors)
				toasts.showErrorToast(`fm${context.id}-import-error`, "Parsing error", `The selected ${pluralize("file", fileList.length)} could not be parsed.`);
			else if (!hasAnyItems)
				toasts.showErrorToast(`fm${context.id}-import-error`, "No geometries", `The selected ${pluralize("file", fileList.length)} did not contain any geometries.`);
			else {
				if (result.errors)
					toasts.showErrorToast(`fm${context.id}-import-error`, "Parsing error", "Some of the selected files could not be parsed.", { variant: "warning" });

				const layer = markRaw(new SearchResultsLayer(result.features, { pathOptions: { weight: 7 } }).addTo(mapContext.value.components.map));
				if (result.features.length > 0) {
					mapContext.value.components.map.flyToBounds(layer.getBounds());
				}

				mapContext.value.components.selectionHandler.addSearchResultLayer(layer);

				files.value.push(result);
				layers.push(layer);
				setTimeout(() => {
					searchBoxContext.value.activateTab(`fm${context.id}-import-tab-${files.value.length - 1}`, { expand: true });
				}, 0);
			}
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-import-error`, "Error reading files", err);
		}
	}

	function close(idx: number): void {
		files.value.splice(idx, 1);
		mapContext.value.components.selectionHandler.removeSearchResultLayer(layers[idx]);
		layers[idx].remove();
		layers.splice(idx, 1);
	}
</script>

<template>
	<div>
		<input type="file" multiple class="d-none" ref="fileInputRef" @change="importFiles(fileInputRef!.files ?? undefined)">
		<template v-for="(file, idx) in files" :key="idx">
			<SearchBoxTab
				:id="`fm${context.id}-import-tab-${idx}`"
				class="fm-import-tab"
				isCloseable
				:title="file.title"
				@close="close(idx)"
			>
				<FileResults
					:file="file"
					:layer-id="layerIds[idx]"
					auto-zoom
				></FileResults>
			</SearchBoxTab>
		</template>
	</div>
</template>

<style lang="scss">
	.fm-import-tab.fm-import-tab.fm-import-tab {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
	}
</style>