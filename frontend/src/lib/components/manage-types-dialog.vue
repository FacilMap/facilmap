<script setup lang="ts">
	import type { ID, Type } from "facilmap-types";
	import EditTypeDialog from "./edit-type-dialog/edit-type-dialog.vue";
	import { computed, ref, watchEffect } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import { showConfirm } from "./ui/alert.vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { injectContextRequired, requireClientContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import DropdownMenu from "./ui/dropdown-menu.vue";
	import { formatTypeName, getOrderedTypes } from "facilmap-utils";
	import Draggable from "vuedraggable";
	import Icon from "./ui/icon.vue";
	import { useI18n } from "../utils/i18n";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const toasts = useToasts();
	const i18n = useI18n();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const isMoving = ref<ID>();
	const isDeleting = ref<Record<ID, boolean>>({ });
	const editDialogTypeId = ref<ID | "createMarkerType" | "createLineType">();

	const isBusy = computed(() => Object.values(isDeleting.value).some((v) => v) || isMoving.value != null);

	async function deleteType(type: Type): Promise<void> {
		toasts.hideToast(`fm${context.id}-manage-types-delete-${type.id}`);
		isDeleting.value[type.id] = true;

		try {
			if (!await showConfirm({
				title: i18n.t("manage-types-dialog.delete-title"),
				message: i18n.t("manage-types-dialog.delete-message", { typeName: formatTypeName(type.name) }),
				variant: "danger",
				okLabel: i18n.t("manage-types-dialog.delete-ok")
			})) {
				return;
			}

			await client.value.deleteType({ id: type.id });
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-manage-types-delete-${type.id}`, () => i18n.t("manage-types-dialog.delete-error", { typeName: formatTypeName(type.name) }), err);
		} finally {
			delete isDeleting.value[type.id];
		}
	}

	const orderedTypes = ref<Type[]>([]);
	watchEffect(() => {
		if (isMoving.value == null) {
			orderedTypes.value = getOrderedTypes(client.value.types);
		}
	});

	const handleDrag = toasts.toastErrors(async (e: any) => {
		if (e.moved) {
			isMoving.value = e.moved.element.id;

			try {
				// This handler is called when orderedTypes is already reordered
				const newIdx = e.moved.newIndex === 0 ? 0 : (orderedTypes.value[e.moved.newIndex - 1].idx + 1);
				await client.value.editType({
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
		:title="i18n.t('manage-types-dialog.title')"
		:isBusy="isBusy"
		size="lg"
		class="fm-manage-types"
		@hidden="emit('hidden')"
	>
		<table class="table table-striped table-hover">
			<thead>
				<tr>
					<th>{{i18n.t("manage-types-dialog.name")}}</th>
					<th>{{i18n.t("manage-types-dialog.type")}}</th>
					<th>{{i18n.t("manage-types-dialog.edit")}}</th>
				</tr>
			</thead>
			<Draggable
				v-model="orderedTypes"
				tag="tbody"
				handle=".fm-drag-handle"
				itemKey="id"
				@change="handleDrag"
			>
				<template #item="{ element: type }">
					<tr>
						<td class="text-break">{{formatTypeName(type.name)}}</td>
						<td>
							{{type.type === "marker" ? i18n.t("manage-types-dialog.type-marker") : i18n.t("manage-types-dialog.type-line")}}
						</td>
						<td class="td-buttons">
							<button
								type="button"
								class="btn btn-secondary"
								:disabled="isDeleting[type.id]"
								@click="editDialogTypeId = type.id"
							>{{i18n.t("manage-types-dialog.edit-button")}}</button>
							<button
								type="button"
								@click="deleteType(type)"
								class="btn btn-secondary"
								:disabled="isDeleting[type.id] || isMoving != null"
							>
								<div v-if="isDeleting[type.id]" class="spinner-border spinner-border-sm"></div>
								{{i18n.t("manage-types-dialog.delete-button")}}
							</button>
							<button
								type="button"
								class="btn btn-secondary fm-drag-handle"
								:disabled="isDeleting[type.id] || isMoving != null"
							>
								<div v-if="isMoving === type.id" class="spinner-border spinner-border-sm"></div>
								<Icon v-else icon="resize-vertical" :alt="i18n.t('manage-types-dialog.reorder-alt')"></Icon>
							</button>
						</td>
					</tr>
				</template>
			</Draggable>
			<tfoot>
				<tr>
					<td colspan="3">
						<DropdownMenu :label="i18n.t('manage-types-dialog.create')">
							<li>
								<a
									href="javascript:"
									class="dropdown-item"
									@click="editDialogTypeId = 'createMarkerType'"
								>{{i18n.t("manage-types-dialog.marker-type")}}</a>
							</li>

							<li>
								<a
									href="javascript:"
									class="dropdown-item"
									@click="editDialogTypeId = 'createLineType'"
								>{{i18n.t("manage-types-dialog.line-type")}}</a>
							</li>
						</DropdownMenu>
					</td>
				</tr>
			</tfoot>
		</table>

		<EditTypeDialog
			v-if="editDialogTypeId"
			:typeId="editDialogTypeId"
			@hidden="editDialogTypeId = undefined"
		></EditTypeDialog>
	</ModalDialog>
</template>