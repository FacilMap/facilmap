import WithRender from "./import.vue";
import Vue from "vue";
import { Component, Ref } from "vue-property-decorator";
import { InjectMapComponents } from "../../utils/decorators";
import { MapComponents } from "../leaflet-map/leaflet-map";
import { showErrorToast } from "../../utils/toasts";
import { FileResults, parseFiles } from "../../utils/files";
import pluralize from "pluralize";
import Icon from "../ui/icon/icon";
import "./import.scss";
import { SearchResultsLayer } from "facilmap-leaflet";

@WithRender
@Component({
	components: { Icon }
})
export default class Import extends Vue {

	@InjectMapComponents() mapComponents!: MapComponents;
	@Ref() fileInput!: HTMLInputElement;

	files: Array<FileResults & { title: string }> = [];
	layers!: SearchResultsLayer[]; // Don't make layer objects reactive

	created(): void {
		this.layers = [];
	}

	mounted(): void {
		this.$root.$on("fm-import-file", this.handleImportFile);
		this.mapComponents.container.addEventListener("dragenter", this.handleMapDragEnter);
		this.mapComponents.container.addEventListener("dragover", this.handleMapDragOver);
		this.mapComponents.container.addEventListener("drop", this.handleMapDrop);
	}

	beforeDestroy(): void {
		this.$root.$off("fm-import-file", this.handleImportFile);
		this.mapComponents.container.removeEventListener("dragenter", this.handleMapDragEnter);
		this.mapComponents.container.removeEventListener("dragover", this.handleMapDragOver);
		this.mapComponents.container.removeEventListener("drop", this.handleMapDrop);
	}

	handleImportFile(): void {
		this.fileInput.click();
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

				this.files.push(result);
				setTimeout(() => {
					this.$root.$emit("fm-search-box-show-tab", `fm-import-${this.files.length -1}`);
				}, 0);
			}
		} catch (err) {
			showErrorToast(this, "fm-import-error", "Error reading files", err);
		}
	}

	close(idx: number): void {
		this.files.splice(idx, 1);
	}

}