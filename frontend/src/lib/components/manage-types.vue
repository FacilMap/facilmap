<script setup lang="ts">
	import { ID, Type } from "facilmap-types";
	import EditType from "../edit-type/edit-type.vue";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { computed, ref } from "vue";
	import { hideToast, showErrorToast } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";
	import Modal from "../ui/modal/modal.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();

	const isDeleting = ref<Record<ID, boolean>>({ });
	const editDialogTypeId = ref<ID | null>(); // null: create dialog

	const isBusy = computed(() => Object.values(isDeleting.value).some((v) => v));

	async function deleteType(type: Type): Promise<void> {
		hideToast(`fm${context.id}-manage-types-delete-${type.id}`);
		isDeleting.value[type.id] = true;

		try {
			if (!await showConfirm({
				title: "Delete type",
				message: `Do you really want to delete the type “${type.name}”?`,
				variant: "danger"
			})) {
				return;
			}

			await client.deleteType({ id: type.id });
		} catch (err) {
			showErrorToast(`fm${context.id}-manage-types-delete-${type.id}`, `Error deleting type “${type.name}”`, err);
		} finally {
			delete isDeleting.value[type.id];
		}
	}
</script>

<template>
	<Modal
		title="Manage Types"
		ok-only
		:busy="isBusy"
		size="lg"
		dialog-class="fm-manage-types"
	>
		<table class="table table-striped table-hover">
			<thead>
				<tr>
					<th>Name</th>
					<th>Type</th>
					<th>Edit</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="type in client.types">
					<td>{{type.name}}</td>
					<td>{{type.type}}</td>
					<td class="td-buttons">
						<div class="btn-group">
							<button
								type="button"
								class="btn btn-light"
								:disabled="isDeleting[type.id]"
								@click="editDialogTypeId = type.id"
							>Edit</button>
							<button
								type="button"
								@click="deleteType(type)"
								class="btn btn-light"
								:disabled="isDeleting[type.id]"
							>
								<div v-if="isDeleting[type.id]" class="spinner-border spinner-border-sm"></div>
								Delete
							</button>
						</div>
					</td>
				</tr>
			</tbody>
			<tfoot>
				<tr>
					<td colspan="3">
						<button
							type="button"
							class="btn btn-light"
							@click="editDialogTypeId = null"
						>Create</button>
					</td>
				</tr>
			</tfoot>
		</table>

		<EditType v-if="editDialogTypeId !== undefined" :typeId="editDialogTypeId"></EditType>
	</Modal>
</template>