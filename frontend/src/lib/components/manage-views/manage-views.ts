import WithRender from "./manage-views.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Client, InjectClient, InjectContext, InjectMapComponents } from "../../utils/decorators";
import { ID, View } from "facilmap-types";
import { displayView } from "facilmap-leaflet";
import { showErrorToast } from "../../utils/toasts";
import { MapComponents } from "../leaflet-map/leaflet-map";
import { Context } from "../facilmap/facilmap";

@WithRender
@Component({})
export default class ManageViews extends Vue {

	@InjectContext() context!: Context;
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
		this.$bvToast.hide(`fm${this.context.id}-save-view-error-default`);

		try {
			await this.client.editPad({ defaultViewId: view.id });
		} catch (err) {
			showErrorToast(this, `fm${this.context.id}-save-view-error-default`, "Error setting default view", err);
		} finally {
			this.isSavingDefaultView = null;
		}
	};

	async deleteView(view: View): Promise<void> {
		this.$bvToast.hide(`fm${this.context.id}-save-view-error-${view.id}`);

		try {
			if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the view “${view.name}”?`))
				return;

			Vue.set(this.isDeleting, view.id, true);

			await this.client.deleteView({ id: view.id });
		} catch (err) {
			showErrorToast(this, `fm${this.context.id}-save-view-error-${view.id}`, `Error deleting view “${view.name}”`, err);
		} finally {
			Vue.delete(this.isDeleting, view.id);
		}
	};
}
