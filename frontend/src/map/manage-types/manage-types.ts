import { Component, Prop } from "vue-property-decorator";
import WithRender from "./manage-types.vue";
import Vue from "vue";
import { ID, Type } from "facilmap-types";
import { InjectClient } from "../client/client";
import Client from "facilmap-client";
import { showErrorToast } from "../../utils/toasts";
import EditType from "../edit-type/edit-type";

@WithRender
@Component({
	components: { EditType }
})
export default class ManageTypes extends Vue {

	@InjectClient() client!: Client;

	@Prop({ type: String, required: true }) id!: string;

	isDeleting: Record<ID, boolean> = { };
	showEditDialog = false;
	editDialogTypeId: ID | null = null;

	isBusy(): boolean {
		return Object.values(this.isDeleting).some((v) => v);
	}

	openEditDialog(type: Type | null): void {
		this.editDialogTypeId = type && type.id;
		this.showEditDialog = true;
		setTimeout(() => { this.$bvModal.show("fm-manage-types-edit-type"); }, 0);
	}

	openCreateDialog(): void {
		this.openEditDialog(null);
	}

	async deleteType(type: Type): Promise<void> {
		this.$bvToast.hide(`fm-manage-types-delete-${type.id}`);
		Vue.set(this.isDeleting, type.id, true);

		try {
			if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the type “${type.name}”?`))
				return;

			await this.client.deleteType({ id: type.id });
		} catch (err) {
			showErrorToast(this, `fm-manage-types-delete-${type.id}`, `Error deleting type “${type.name}”`, err);
		} finally {
			Vue.delete(this.isDeleting, type.id);
		}
	}

}