<script setup lang="ts">
	import { FileResultObject, parseFiles } from "../utils/files";
	import pluralize from "pluralize";
	import { SearchResultsLayer } from "facilmap-leaflet";
	import { Util } from "leaflet";
	import FileResults from "./file-results.vue";
	import SearchBoxTab from "./search-box/search-box-tab.vue";
	import { injectContextRequired } from "../utils/context";
	import { injectMapContextRequired } from "./leaflet-map/leaflet-map.vue";
	import { computed, markRaw, ref } from "vue";
	import { useDomEventListener, useEventListener } from "../utils/utils";
	import { useToasts } from "./ui/toasts/toasts.vue";

	const context = injectContextRequired();
	const mapContext = injectMapContextRequired();
	const toasts = useToasts();

	const fileInputRef = ref<HTMLInputElement>();

	const files = ref<Array<FileResultObject & { title: string }>>([]);
	const layers = ref<SearchResultsLayer[]>([]);

	useEventListener(mapContext, "import-file", handleImportFile);
	useEventListener(mapContext, "open-selection", handleOpenSelection);

	useDomEventListener(mapContext.components.container, "dragenter", handleMapDragEnter);
	useDomEventListener(mapContext.components.container, "dragover", handleMapDragOver);
	useDomEventListener(mapContext.components.container, "drop", handleMapDrop);

	const layerIds = computed(() => layers.value.map((layer) => Util.stamp(layer)));

	function handleImportFile(): void {
		fileInputRef.value?.click();
	}

	function handleOpenSelection(): void {
		for (let i = 0; i < layerIds.value.length; i++) {
			if (mapContext.selection.some((item) => item.type == "searchResult" && item.layerId == layerIds.value[i])) {
				mapContext.emit("search-box-show-tab", { id: `fm${context.id}-import-tab-${i}` });
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

		importFiles((event as DragEvent).dataTransfer?.files);
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
				...parseFiles(loadedFiles),
				title: (fileList.length == 1 && fileList[0].name) || pluralize("file", fileList.length, true)
			};
			if (result.features.length == 0 && result.errors)
				toasts.showErrorToast(`fm${context.id}-import-error`, "Parsing error", `The selected ${pluralize("file", fileList.length)} could not be parsed.`);
			else if (result.features.length == 0)
				toasts.showErrorToast(`fm${context.id}-import-error`, "No geometries", `The selected ${pluralize("file", fileList.length)} did not contain any geometries.`);
			else {
				if (result.errors)
					toasts.showErrorToast(`fm${context.id}-import-error`, "Parsing error", "Some of the selected files could not be parsed.", { variant: "warning" });

				const layer = markRaw(new SearchResultsLayer(result.features, { pathOptions: { weight: 7 } }).addTo(mapContext.components.map));
				mapContext.components.map.flyToBounds(layer.getBounds());
				mapContext.components.selectionHandler.addSearchResultLayer(layer);

				files.value.push(result);
				layers.value.push(layer);
				setTimeout(() => {
					mapContext.emit("search-box-show-tab", { id: `fm${context.id}-import-tab-${files.value.length - 1}` });
				}, 0);
			}
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-import-error`, "Error reading files", err);
		}
	}

	function close(idx: number): void {
		files.value.splice(idx, 1);
		mapContext.components.selectionHandler.removeSearchResultLayer(layers.value[idx]);
		layers.value[idx].remove();
		layers.value.splice(idx, 1);
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