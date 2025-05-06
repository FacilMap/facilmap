<script setup lang="ts">
	import { computed, ref, watch } from "vue";
	import { T, useI18n } from "../../utils/i18n";
	import { getUniqueId } from "../../utils/utils";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { getClientSub, injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { showConfirm } from "../ui/alert.vue";
	import type { CRU, MapData, MergedUnion } from "facilmap-types";

	const i18n = useI18n();
	const toasts = useToasts();

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = getClientSub(context);

	const id = getUniqueId("fm-map-settings-delete");

	const props = defineProps<{
		mapData: MergedUnion<[MapData<CRU.CREATE>, Required<MapData<CRU.UPDATE>>]>;
		isSubmitting?: boolean;
	}>();

	const emit = defineEmits<{
		"update:isDeleting": [boolean];
		"deleted": [];
	}>();

	const isDeleting = ref(false);
	watch(isDeleting, () => {
		emit("update:isDeleting", isDeleting.value);
	});

	const deleteConfirmation = ref("");
	const expectedDeleteConfirmation = computed(() => i18n.t('map-settings-dialog.delete-code'));

	async function deleteMap(): Promise<void> {
		toasts.hideToast(`fm${context.id}-map-settings-error`);

		if (!await showConfirm({
			title: i18n.t("map-settings-dialog.delete-map-title"),
			message: i18n.t("map-settings-dialog.delete-map-message", { name: props.mapData.name }),
			variant: "danger",
			okLabel: i18n.t("map-settings-dialog.delete-map-ok")
		})) {
			return;
		}

		isDeleting.value = true;

		try {
			await clientContext.value.client.deleteMap(clientSub.value!.mapSlug);
			emit("deleted");
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-map-settings-error`, () => i18n.t("map-settings-dialog.delete-map-error"), err);
		} finally {
			isDeleting.value = false;
		}
	};
</script>

<template>
	<div class="row mb-3">
		<label :for="`${id}-delete-input`" class="col-sm-3 col-form-label">{{i18n.t("map-settings-dialog.delete-map")}}</label>
		<div class="col-sm-9">
			<div class="input-group">
				<input
					:form="`${id}-delete-form`"
					:id="`${id}-delete-input`"
					class="form-control"
					type="text"
					v-model="deleteConfirmation"
				/>
				<button
					:form="`${id}-delete-form`"
					class="btn btn-danger"
					type="submit"
					:disabled="isDeleting || props.isSubmitting || deleteConfirmation != expectedDeleteConfirmation"
				>
					<div v-if="isDeleting" class="spinner-border spinner-border-sm"></div>
					{{i18n.t("map-settings-dialog.delete-map-button")}}
				</button>
			</div>
			<div class="form-text">
				<T k="map-settings-dialog.delete-description">
					<template #code>
						<code>{{expectedDeleteConfirmation}}</code>
					</template>
				</T>
			</div>
		</div>
	</div>

	<form :id="`${id}-delete-form`" @submit.prevent="deleteConfirmation == expectedDeleteConfirmation && deleteMap()">
	</form>
</template>