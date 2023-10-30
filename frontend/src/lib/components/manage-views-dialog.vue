<script setup lang="ts">
	import { ID, View } from "facilmap-types";
	import { displayView } from "facilmap-leaflet";
	import { injectContextRequired } from "../utils/context";
	import { injectClientRequired } from "./client-context.vue";
	import { computed, reactive, ref } from "vue";
	import { injectMapContextRequired } from "./leaflet-map/leaflet-map.vue";
	import { useToasts } from "./ui/toasts/toasts.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	const toasts = useToasts();

	const isSavingDefaultView = ref<ID>();
	const isDeleting = reactive<Record<ID, boolean>>({});

	const isBusy = computed(() => {
		return isSavingDefaultView.value != null || Object.values(isDeleting).some((v) => v);
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
			if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the view “${view.name}”?`))
				return;

			this.isDeleting[view.id] = true;

			await this.client.deleteView({ id: view.id });
		} catch (err) {
			toasts.showErrorToast(this, `fm${this.context.id}-save-view-error-${view.id}`, `Error deleting view “${view.name}”`, err);
		} finally {
			Vue.delete(this.isDeleting, view.id);
		}
	};
</script>

<template>
	<b-modal :id="id" title="Manage Views" ok-only ok-title="Close" :busy="isBusy()" size="lg" class="fm-manage-views">
		<table class="table table-striped table-hover">
			<tbody>
				<tr v-for="view in client.views">
					<td :class="{ 'font-weight-bold': client.padData.defaultView && view.id == client.padData.defaultView.id }"><a href="javascript:" @click="display(view)">{{view.name}}</a></td>
					<td class="td-buttons text-right">
						<button
							type="button"
							class="btn btn-light"
							v-show="!client.padData.defaultView || view.id !== client.padData.defaultView.id"
							@click="makeDefault(view)"
							:disabled="!!isSavingDefaultView || isDeleting[view.id]"
						>
							<div v-if="isSavingDefaultView == view.id" class="spinner-border spinner-border-sm"></div>
							Make default
						</button>
						<button
							type="button"
							class="btn btn-light"
							@click="deleteView(view)"
							:disabled="isDeleting[view.id] || isSavingDefaultView == view.id"
						>
							<div v-if="isDeleting[view.id]" class="spinner-border spinner-border-sm"></div>
							Delete
						</button>
					</td>
				</tr>
			</tbody>
		</table>
	</b-modal>
</template>