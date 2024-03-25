<script setup lang="ts">
	import type { ID, View } from "facilmap-types";
	import { displayView } from "facilmap-leaflet";
	import { computed, ref, watchEffect } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import { showConfirm } from "./ui/alert.vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import { getOrderedViews } from "facilmap-utils";
	import Draggable from "vuedraggable";
	import Icon from "./ui/icon.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const toasts = useToasts();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const isSavingDefaultView = ref<ID>();
	const isMoving = ref<ID>();
	const isDeleting = ref(new Set<ID>());

	const isBusy = computed(() => {
		return isSavingDefaultView.value != null || isDeleting.value.size > 0 || isMoving.value != null;
	});

	function display(view: View): void {
		displayView(mapContext.value.components.map, view, { overpassLayer: mapContext.value.components.overpassLayer });
	};

	async function makeDefault(view: View): Promise<void> {
		isSavingDefaultView.value = view.id;
		toasts.hideToast(`fm${context.id}-save-view-error-default`);

		try {
			await client.value.editPad({ defaultViewId: view.id });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-save-view-error-default`, "Error setting default view", err);
		} finally {
			isSavingDefaultView.value = undefined;
		}
	};

	async function deleteView(view: View): Promise<void> {
		toasts.hideToast(`fm${context.id}-save-view-error-${view.id}`);

		try {
			if (!await showConfirm({
				title: "Delete view",
				message: `Do you really want to delete the view “${view.name}”?`,
				variant: "danger",
				okLabel: "Delete"
			}))
				return;

			isDeleting.value.add(view.id);

			await client.value.deleteView({ id: view.id });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-save-view-error-${view.id}`, `Error deleting view “${view.name}”`, err);
		} finally {
			isDeleting.value.delete(view.id);
		}
	};

	const orderedViews = ref<View[]>([]);
	watchEffect(() => {
		if (isMoving.value == null) {
			orderedViews.value = getOrderedViews(client.value.views);
		}
	});

	const handleDrag = toasts.toastErrors(async (e: any) => {
		if (e.moved) {
			isMoving.value = e.moved.element.id;

			try {
				// This handler is called when orderedViews is already reordered
				const newIdx = e.moved.newIndex === 0 ? 0 : (orderedViews.value[e.moved.newIndex - 1].idx + 1);
				await client.value.editView({
					id: e.moved.element.id,
					idx: newIdx
				});
			} finally {
				isMoving.value = undefined;
			}
		}
	});
</script>

<template>
	<ModalDialog
		title="Manage Views"
		:isBusy="isBusy"
		size="lg"
		class="fm-manage-views"
		@hidden="emit('hidden')"
	>
		<table class="table table-striped table-hover">
			<Draggable
				v-model="orderedViews"
				tag="tbody"
				handle=".fm-drag-handle"
				itemKey="id"
				@change="handleDrag"
			>
				<template #item="{ element: view }">
					<tr>
						<td
							class="text-break"
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
								:disabled="isDeleting.has(view.id) || isSavingDefaultView == view.id || isMoving != null"
							>
								<div v-if="isDeleting.has(view.id)" class="spinner-border spinner-border-sm"></div>
								Delete
							</button>
							<button
								type="button"
								class="btn btn-secondary fm-drag-handle"
								:disabled="isDeleting.has(view.id) || isMoving != null"
							>
								<div v-if="isMoving === view.id" class="spinner-border spinner-border-sm"></div>
								<Icon v-else icon="resize-vertical" alt="Reorder"></Icon>
							</button>
						</td>
					</tr>
				</template>
			</Draggable>
		</table>
	</ModalDialog>
</template>