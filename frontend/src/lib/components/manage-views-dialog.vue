<script setup lang="ts">
	import type { ID, View } from "facilmap-types";
	import { displayView } from "facilmap-leaflet";
	import { injectContextRequired } from "../utils/context";
	import { injectClientRequired } from "./client-context.vue";
	import { computed, ref } from "vue";
	import { injectMapContextRequired } from "./leaflet-map/leaflet-map.vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import { showConfirm } from "./ui/alert.vue";
	import ModalDialog from "./ui/modal-dialog.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();
	const toasts = useToasts();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const isSavingDefaultView = ref<ID>();
	const isDeleting = ref(new Set<ID>());

	const isBusy = computed(() => {
		return isSavingDefaultView.value != null || isDeleting.value.size > 0;
	});

	function display(view: View): void {
		displayView(mapContext.components.map, view, { overpassLayer: mapContext.components.overpassLayer });
	};

	async function makeDefault(view: View): Promise<void> {
		isSavingDefaultView.value = view.id;
		toasts.hideToast(`fm${context.id}-save-view-error-default`);

		try {
			await client.editPad({ defaultViewId: view.id });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-save-view-error-default`, "Error setting default view", err);
		} finally {
			isSavingDefaultView.value = undefined;
		}
	};

	async function deleteView(view: View): Promise<void> {
		toasts.hideToast(`fm${context.id}-save-view-error-${view.id}`);

		try {
			if (!await showConfirm({ title: "Delete view", message: `Do you really want to delete the view “${view.name}”?` }))
				return;

			isDeleting.value.add(view.id);

			await client.deleteView({ id: view.id });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-save-view-error-${view.id}`, `Error deleting view “${view.name}”`, err);
		} finally {
			isDeleting.value.delete(view.id);
		}
	};
</script>

<template>
	<ModalDialog
		title="Manage Views"
		okOnly
		:isBusy="isBusy"
		size="lg"
		class="fm-manage-views"
		@hidden="emit('hidden')"
	>
		<table class="table table-striped table-hover">
			<tbody>
				<tr v-for="view in client.views" :key="view.id">
					<td
						:class="{
							'font-weight-bold': client.padData?.defaultView && view.id == client.padData.defaultView.id
						}"
					>
						<a href="javascript:" @click="display(view)">{{view.name}}</a>
					</td>
					<td class="td-buttons text-right">
						<button
							type="button"
							class="btn btn-secondary"
							v-show="!client.padData?.defaultView || view.id !== client.padData.defaultView.id"
							@click="makeDefault(view)"
							:disabled="!!isSavingDefaultView || isDeleting.has(view.id)"
						>
							<div v-if="isSavingDefaultView == view.id" class="spinner-border spinner-border-sm"></div>
							Make default
						</button>
						<button
							type="button"
							class="btn btn-secondary"
							@click="deleteView(view)"
							:disabled="isDeleting.has(view.id) || isSavingDefaultView == view.id"
						>
							<div v-if="isDeleting.has(view.id)" class="spinner-border spinner-border-sm"></div>
							Delete
						</button>
					</td>
				</tr>
			</tbody>
		</table>
	</ModalDialog>
</template>