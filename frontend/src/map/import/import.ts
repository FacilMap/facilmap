import WithRender from "./import.vue";
import Vue from "vue";
import { Component, Ref } from "vue-property-decorator";
import { InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { showErrorToast } from "../../utils/toasts";
import { FileResult, FileResultObject, parseFiles } from "../../utils/files";
import pluralize from "pluralize";
import Icon from "../ui/icon/icon";
import "./import.scss";
import { SearchResultsLayer } from "facilmap-leaflet";
import { Util } from "leaflet";
import FileResults from "../file-results/file-results";
import { flyTo } from "../../utils/zoom";

@WithRender
@Component({
	components: { Icon, FileResults }
})
export default class Import extends Vue {

	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectMapContext() mapContext!: MapContext;
	@Ref() fileInput!: HTMLInputElement;

	files: Array<FileResultObject & { title: string }> = [];
	layers!: SearchResultsLayer[]; // Don't make layer objects reactive

	created(): void {
		this.layers = [];
	}

	mounted(): void {
		this.mapContext.$on("fm-import-file", this.handleImportFile);
		this.mapContext.$on("fm-open-selection", this.handleOpenSelection);
		this.mapComponents.container.addEventListener("dragenter", this.handleMapDragEnter);
		this.mapComponents.container.addEventListener("dragover", this.handleMapDragOver);
		this.mapComponents.container.addEventListener("drop", this.handleMapDrop);
	}

	beforeDestroy(): void {
		this.mapContext.$off("fm-import-file", this.handleImportFile);
		this.mapContext.$off("fm-open-selection", this.handleOpenSelection);
		this.mapComponents.container.removeEventListener("dragenter", this.handleMapDragEnter);
		this.mapComponents.container.removeEventListener("dragover", this.handleMapDragOver);
		this.mapComponents.container.removeEventListener("drop", this.handleMapDrop);
	}

	get layerIds(): number[] {
		return this.files.map((file, i) => { // Iterate files instead of layers because it is reactive
			return Util.stamp(this.layers[i]);
		});
	}

	handleImportFile(): void {
		this.fileInput.click();
	}

	handleOpenSelection(): void {
		for (let i = 0; i < this.layerIds.length; i++) {
			if (this.mapContext.selection.some((item) => item.type == "searchResult" && item.layerId == this.layerIds[i])) {
				this.mapContext.$emit("fm-search-box-show-tab", `fm-import-tab-${i}`);
				break;
			}
		}
	}

	handleMapDragEnter(event: DragEvent): void {
		event.preventDefault();
	}

	handleMapDragOver(event: DragEvent): void {
		event.preventDefault();
	}

	handleMapDrop(event: DragEvent): void {
		event.preventDefault();

		this.importFiles(event.dataTransfer?.files);
	}

	zoomToResult(result: FileResult): void {
		const layer = this.layers.find((layer, idx) => this.files[idx].features.includes(result));
		if (!layer)
			return;
		
		const featureLayer = layer.getLayers().find((l) => l._fmSearchResult === result) as any;
		if (!featureLayer)
			return;

		flyTo(this.mapComponents.map, { bounds: featureLayer.getBounds() });
	}

	async importFiles(files: FileList | undefined): Promise<void> {
		this.$bvToast.hide("fm-import-error");

		if(!files || files.length == 0)
			return;

		try {
			const loadedFiles = await Promise.all([...files].map((file) => new Promise<string>((resolve, reject) => {
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
				title: (files.length == 1 && files[0].name) || pluralize("file", files.length, true)
			};
			if (result.features.length == 0 && result.errors)
				showErrorToast(this, "fm-import-error", "Parsing error", `The selected ${pluralize("file", files.length)} could not be parsed.`);
			else if (result.features.length == 0)
				showErrorToast(this, "fm-import-error", "No geometries", `The selected ${pluralize("file", files.length)} did not contain any geometries.`);
			else {
				if (result.errors)
					showErrorToast(this, "fm-import-error", "Parsing error", "Some of the selected files could not be parsed.", { variant: "warning" });

				const layer = new SearchResultsLayer(result.features).addTo(this.mapComponents.map);
				this.mapComponents.map.flyToBounds(layer.getBounds());
				this.mapComponents.selectionHandler.addSearchResultLayer(layer);

				this.files.push(result);
				this.layers.push(layer);
				setTimeout(() => {
					this.mapContext.$emit("fm-search-box-show-tab", `fm-import-tab-${this.files.length -1}`);
				}, 0);
			}
		} catch (err) {
			showErrorToast(this, "fm-import-error", "Error reading files", err);
		}
	}

	close(idx: number): void {
		this.files.splice(idx, 1);
		this.layers[idx].remove();
		this.mapComponents.selectionHandler.addSearchResultLayer(this.layers[idx]);
		this.layers.splice(idx, 1);
	}

}