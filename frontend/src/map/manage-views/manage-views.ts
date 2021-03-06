import WithRender from "./manage-views.vue";
import Vue from "vue";
import Client from "facilmap-client";
import { InjectClient } from "../client/client";
import { Component, Prop } from "vue-property-decorator";
import { InjectMapComponents, MapComponents } from "../leaflet-map/leaflet-map";
import { ID, View } from "facilmap-types";
import { displayView } from "facilmap-leaflet";
import { showErrorToast } from "../../utils/toasts";

@WithRender
@Component({})
export default class ManageViews extends Vue {
	
	@InjectClient() client!: Client;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: String, required: true }) id!: string;

	isSavingDefaultView: ID | null = null;
	isDeleting: Record<ID, boolean> = {};

	isBusy(): boolean {
		return this.isSavingDefaultView != null || Object.values(this.isDeleting).some((v) => v);
	}

	display(view: View): void {
		displayView(this.mapComponents.map, view);
	};

	async makeDefault(view: View): Promise<void> {
		this.isSavingDefaultView = view.id;
		this.$bvToast.hide(`fm-save-view-error-default`);

		try {
			await this.client.editPad({ defaultViewId: view.id });
		} catch (err) {
			showErrorToast(this, "fm-save-view-error-default", "Error setting default view", err);
		} finally {
			this.isSavingDefaultView = null;
		}
	};

	async deleteView(view: View): Promise<void> {
		Vue.set(this.isDeleting, view.id, true);
		this.$bvToast.hide(`fm-save-view-error-${view.id}`);

		try {
			if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the view “${view.name}”?`))
				return;

			await this.client.deleteView({ id: view.id });
		} catch (err) {
			showErrorToast(this, `fm-save-view-error-${view.id}`, "Error deleting view", err);
		} finally {
			Vue.delete(this.isDeleting, view.id);
		}
	};
}
