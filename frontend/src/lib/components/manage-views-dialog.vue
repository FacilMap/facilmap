<script setup lang="ts">
	import type { DeepReadonly, ID, View } from "facilmap-types";
	import { displayView } from "facilmap-leaflet";
	import { computed, ref, watchEffect } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import { showConfirm } from "./ui/alert.vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { injectContextRequired, requireClientContext, requireClientSub, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import { getOrderedViews } from "facilmap-utils";
	import Draggable from "vuedraggable";
	import Icon from "./ui/icon.vue";
	import { useI18n } from "../utils/i18n";

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = requireClientSub(context);
	const mapContext = requireMapContext(context);
	const toasts = useToasts();
	const i18n = useI18n();

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
			await clientContext.value.client.updateMap(clientSub.value.mapSlug, { defaultViewId: view.id });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-save-view-error-default`, () => i18n.t("manage-views-dialog.default-view-error"), err);
		} finally {
			isSavingDefaultView.value = undefined;
		}
	};

	async function deleteView(view: View): Promise<void> {
		toasts.hideToast(`fm${context.id}-save-view-error-${view.id}`);

		try {
			if (!await showConfirm({
				title: i18n.t("manage-views-dialog.delete-view-title"),
				message: i18n.t("manage-views-dialog.delete-view-message", { viewName: view.name }),
				variant: "danger",
				okLabel: i18n.t("manage-views-dialog.delete-view-ok")
			}))
				return;

			isDeleting.value.add(view.id);

			await clientContext.value.client.deleteView(clientSub.value.mapSlug, view.id);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-save-view-error-${view.id}`, () => i18n.t("manage-views-dialog.delete-view-error", { viewName: view.name }), err);
		} finally {
			isDeleting.value.delete(view.id);
		}
	};

	const orderedViews = ref<DeepReadonly<View>[]>([]);
	watchEffect(() => {
		if (isMoving.value == null) {
			orderedViews.value = getOrderedViews(clientSub.value.data.views);
		}
	});

	const handleDrag = toasts.toastErrors(async (e: any) => {
		if (e.moved) {
			isMoving.value = e.moved.element.id;

			try {
				// This handler is called when orderedViews is already reordered
				const newIdx = e.moved.newIndex === 0 ? 0 : (orderedViews.value[e.moved.newIndex - 1].idx + 1);
				await clientContext.value.client.updateView(clientSub.value.mapSlug, e.moved.element.id, { idx: newIdx });
			} finally {
				isMoving.value = undefined;
			}
		}
	});
</script>

<template>
	<ModalDialog
		:title="i18n.t('manage-views-dialog.title')"
		:isBusy="isBusy"
		size="lg"
		class="fm-manage-views"
		@hidden="emit('hidden')"
	>
		<table class="table table-striped table-hover">
			<Draggable
				v-model="orderedViews"
				tag="tbody"
				v-bind="{ handle: '.fm-drag-handle' } as any /* https://github.com/SortableJS/vue.draggable.next/issues/220 */"
				itemKey="id"
				@change="handleDrag"
			>
				<template #item="{ element: view }">
					<tr>
						<td
							class="text-break align-middle"
							:class="{
								'font-weight-bold': view.id == clientSub.data.mapData.defaultViewId
							}"
						>
							<a href="javascript:" @click="display(view)">{{view.name}}</a>
						</td>
						<td class="td-buttons text-right align-middle">
							<button
								type="button"
								class="btn btn-secondary"
								v-show="!clientSub.data.mapData.defaultViewId || view.id !== clientSub.data.mapData.defaultViewId"
								@click="makeDefault(view)"
								:disabled="!!isSavingDefaultView || isDeleting.has(view.id)"
							>
								<div v-if="isSavingDefaultView == view.id" class="spinner-border spinner-border-sm"></div>
								{{i18n.t("manage-views-dialog.make-default")}}
							</button>
							<button
								type="button"
								class="btn btn-secondary"
								@click="deleteView(view)"
								:disabled="isDeleting.has(view.id) || isSavingDefaultView == view.id || isMoving != null"
							>
								<div v-if="isDeleting.has(view.id)" class="spinner-border spinner-border-sm"></div>
								{{i18n.t("manage-views-dialog.delete")}}
							</button>
							<button
								type="button"
								class="btn btn-secondary fm-drag-handle"
								:disabled="isDeleting.has(view.id) || isMoving != null"
							>
								<div v-if="isMoving === view.id" class="spinner-border spinner-border-sm"></div>
								<Icon v-else icon="resize-vertical" :alt="i18n.t('manage-views-dialog.reorder-alt')"></Icon>
							</button>
						</td>
					</tr>
				</template>
			</Draggable>
		</table>
	</ModalDialog>
</template>