<script setup lang="ts">
	import { Component, Prop } from "vue-property-decorator";
	import WithRender from "./manage-types.vue";
	import Vue from "vue";
	import { ID, Type } from "facilmap-types";
	import { Client, InjectClient, InjectContext } from "../../utils/decorators";
	import { showErrorToast } from "../../utils/toasts";
	import EditType from "../edit-type/edit-type";
	import { Context } from "../facilmap/facilmap";

	@WithRender
	@Component({
		components: { EditType }
	})
	export default class ManageTypes extends Vue {

		@InjectContext() context!: Context;
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
			setTimeout(() => { this.$bvModal.show(`fm${this.context.id}-manage-types-edit-type`); }, 0);
		}

		openCreateDialog(): void {
			this.openEditDialog(null);
		}

		async deleteType(type: Type): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-manage-types-delete-${type.id}`);
			Vue.set(this.isDeleting, type.id, true);

			try {
				if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the type “${type.name}”?`))
					return;

				await this.client.deleteType({ id: type.id });
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-manage-types-delete-${type.id}`, `Error deleting type “${type.name}”`, err);
			} finally {
				Vue.delete(this.isDeleting, type.id);
			}
		}

	}
</script>

<template>
	<b-modal :id="id" title="Manage Types" ok-only ok-title="Close" :busy="isBusy()" size="lg" dialog-class="fm-manage-types">
		<b-table-simple striped hover>
			<b-thead>
				<b-tr>
					<b-th>Name</b-th>
					<b-th>Type</b-th>
					<b-th>Edit</b-th>
				</b-tr>
			</b-thead>
			<b-tbody>
				<b-tr v-for="type in client.types">
					<b-td>{{type.name}}</b-td>
					<b-td>{{type.type}}</b-td>
					<b-td class="td-buttons">
						<b-button-group>
							<b-button :disabled="isDeleting[type.id]" @click="openEditDialog(type)">Edit</b-button>
							<b-button @click="deleteType(type)" class="btn btn-default" :disabled="isDeleting[type.id]">
								<div v-if="isDeleting[type.id]" class="spinner-border spinner-border-sm"></div>
								Delete
							</b-button>
						</b-button-group>
					</b-td>
				</b-tr>
			</b-tbody>
			<b-tfoot>
				<b-tr>
					<b-td colspan="3"><b-button type="button" @click="openCreateDialog()">Create</b-button></b-td>
				</b-tr>
			</b-tfoot>
		</b-table-simple>

		<EditType v-if="showEditDialog" :id="`fm${context.id}-manage-types-edit-type`" :typeId="editDialogTypeId"></EditType>
	</b-modal>
</template>