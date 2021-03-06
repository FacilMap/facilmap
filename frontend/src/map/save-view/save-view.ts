import WithRender from "./save-view.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { InjectMapComponents, InjectMapContext, MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { baseLayers, getCurrentView, overlays } from "facilmap-leaflet";
import { ViewCreate } from "facilmap-types";
import Client from "facilmap-client";
import { InjectClient } from "../client/client";
import FormModal from "../ui/form-modal/form-modal";
import { ValidationProvider } from "vee-validate";
import { getValidationState } from "../../utils/validation";
import { showErrorToast } from "../../utils/toasts";

@WithRender
@Component({
	components: { FormModal, ValidationProvider }
})
export default class SaveView extends Vue {
	
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectMapContext() mapContext!: MapContext;
	@InjectClient() client!: Client;
	
	@Prop({ type: String, required: true }) id!: string;

	isSaving = false;

	view: ViewCreate = null as any;
	filter: string | undefined = null as any;
	makeDefault = false;

	initialize(): void {
		this.view = {
			...getCurrentView(this.mapComponents.map),
			name: ""
		};
		this.filter = this.mapContext.filter;
		this.makeDefault = false;
	}

	get baseLayer(): string {
		return baseLayers[this.view.baseLayer].options.fmName || this.view.baseLayer;
	}

	get overlays(): string {
		return this.view.layers.map((key) => overlays[key].options.fmName || key).join(", ") || "—";
	}

	async save(): Promise<void> {
		this.isSaving = true;
		this.$bvToast.hide("fm-save-view-error");

		try {
			const view = await this.client.addView(this.view);

			if (this.makeDefault) {
				await this.client.editPad({ defaultViewId: view.id });
			}

			this.$bvModal.hide(this.id);
		} catch (err) {
			showErrorToast(this, "fm-save-view-error", "Error saving view", err);
		} finally {
			this.isSaving = false;
		}
	};
}