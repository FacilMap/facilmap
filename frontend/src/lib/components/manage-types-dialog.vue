<script setup lang="ts">
	import { ID, Type } from "facilmap-types";
	import EditTypeDialog from "./edit-type-dialog/edit-type-dialog.vue";
	import { injectContextRequired } from "../utils/context";
	import { injectClientRequired } from "./client-context.vue";
	import { computed, ref } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import { showConfirm } from "./ui/alert.vue";
	import ModalDialog from "./ui/modal-dialog.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const toasts = useToasts();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const isDeleting = ref<Record<ID, boolean>>({ });
	const editDialogTypeId = ref<ID | null>(); // null: create dialog

	const isBusy = computed(() => Object.values(isDeleting.value).some((v) => v));

	async function deleteType(type: Type): Promise<void> {
		toasts.hideToast(`fm${context.id}-manage-types-delete-${type.id}`);
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
			toasts.showErrorToast(`fm${context.id}-manage-types-delete-${type.id}`, `Error deleting type “${type.name}”`, err);
		} finally {
			delete isDeleting.value[type.id];
		}
	}
</script>

<template>
	<ModalDialog
		title="Manage Types"
		okOnly
		:isBusy="isBusy"
		size="lg"
		class="fm-manage-types"
		@hidden="emit('hidden')"
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
				<tr v-for="type in client.types" :key="type.id">
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

		<EditTypeDialog v-if="editDialogTypeId !== undefined" :typeId="editDialogTypeId ?? undefined"></EditTypeDialog>
	</ModalDialog>
</template>