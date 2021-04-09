import WithRender from "./file-results.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { FileResultObject } from "../../utils/files";
import { Client, InjectClient, InjectMapComponents } from "../../utils/decorators";
import { showErrorToast } from "../../utils/toasts";
import Icon from "../ui/icon/icon";
import SearchResults from "../search-results/search-results";
import { displayView } from "facilmap-leaflet";
import { MapComponents } from "../leaflet-map/leaflet-map";
import "./file-results.scss";
import { typeExists, viewExists } from "../../utils/search";

type ViewImport = FileResultObject["views"][0];
type TypeImport = FileResultObject["types"][0];

@WithRender
@Component({
	components: { Icon, SearchResults }
})
export default class FileResults extends Vue {

	@InjectClient() client!: Client;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: Number, required: true }) layerId!: number;
	@Prop({ type: Object, required: true }) file!: FileResultObject;

	/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
	@Prop({ type: Boolean, default: false }) unionZoom!: boolean;
	/** When clicking or selecting a search result, zoom to it. */
	@Prop({ type: Boolean, default: false }) autoZoom!: boolean;

	get hasViews(): boolean {
		return this.file.views.length > 0;
	}

	get hasTypes(): boolean {
		return Object.keys(this.file.types).length > 0;
	}

	viewExists(view: ViewImport): boolean {
		return viewExists(this.client, view);
	};

	showView(view: ViewImport): void {
		displayView(this.mapComponents.map, view);
	};

	async addView(view: ViewImport): Promise<void> {
		this.$bvModal.hide("fm-file-result-import-error");

		try {
			await this.client.addView(view);
		} catch (err) {
			showErrorToast(this, "fm-file-result-import-error", "Error importing view", err);
		}
	};

	typeExists(type: TypeImport): boolean {
		return typeExists(this.client, type);
	};

	async addType(type: TypeImport): Promise<void> {
		this.$bvModal.hide("fm-file-result-import-error");

		try {
			this.client.addType(type);
		} catch (err) {
			showErrorToast(this, "fm-file-result-import-error", "Error importing type", err);
		}
	};
	
}