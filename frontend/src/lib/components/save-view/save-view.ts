import WithRender from "./save-view.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { getCurrentView, getLayers } from "facilmap-leaflet";
import FormModal from "../ui/form-modal/form-modal";
import { ValidationProvider } from "vee-validate";
import { showErrorToast } from "../../utils/toasts";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { Context } from "../facilmap/facilmap";

@WithRender
@Component({
	components: { FormModal, ValidationProvider }
})
export default class SaveView extends Vue {

	@InjectContext() context!: Context;
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectMapContext() mapContext!: MapContext;
	@InjectClient() client!: Client;

	@Prop({ type: String, required: true }) id!: string;

	isSaving = false;

	name = "";
	includeOverpass = false;
	includeFilter = false;
	makeDefault = false;

	initialize(): void {
		this.name = "";
		this.includeOverpass = false;
		this.includeFilter = false;
		this.makeDefault = false;
	}

	get baseLayer(): string {
		const { baseLayers } = getLayers(this.mapComponents.map);
		return baseLayers[this.mapContext.layers.baseLayer].options.fmName || this.mapContext.layers.baseLayer;
	}

	get overlays(): string {
		const { overlays } = getLayers(this.mapComponents.map);
		return this.mapContext.layers.overlays.map((key) => overlays[key].options.fmName || key).join(", ") || "—";
	}

	async save(): Promise<void> {
		this.isSaving = true;
		this.$bvToast.hide(`fm${this.context.id}-save-view-error`);

		try {
			const view = await this.client.addView({
				...getCurrentView(this.mapComponents.map, {
					includeFilter: this.includeFilter,
					overpassLayer: this.includeOverpass ? this.mapComponents.overpassLayer : undefined
				}),
				name: this.name
			});

			if (this.makeDefault) {
				await this.client.editPad({ defaultViewId: view.id });
			}

			this.$bvModal.hide(this.id);
		} catch (err) {
			showErrorToast(this, `fm${this.context.id}-save-view-error`, "Error saving view", err);
		} finally {
			this.isSaving = false;
		}
	};
}