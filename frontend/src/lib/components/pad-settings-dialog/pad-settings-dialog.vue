<script setup lang="ts">
	import { computed, ref, watch } from "vue";
	import { padDataValidator, type CRU, type PadData } from "facilmap-types";
	import { generateRandomPadId, mergeObject } from "facilmap-utils";
	import { getUniqueId, getZodValidator } from "../../utils/utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";
	import PadIdEdit from "./pad-id-edit.vue";
	import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "../ui/validated-form/validated-field.vue";
	import { T, useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const client = requireClientContext(context);

	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		proposedAdminId?: string;
		noCancel?: boolean;
		isCreate?: boolean;
	}>();

	const emit = defineEmits<{
		hide: [];
		hidden: [];
	}>();

	const id = getUniqueId("fm-pad-settings");
	const isDeleting = ref(false);
	const deleteConfirmation = ref("");
	const expectedDeleteConfirmation = computed(() => i18n.t('pad-settings-dialog.delete-code'));

	const initialPadData: PadData<CRU.CREATE> | undefined = props.isCreate ? {
		name: "",
		searchEngines: false,
		description: "",
		clusterMarkers: false,
		adminId: (props.proposedAdminId || generateRandomPadId(16)),
		writeId: generateRandomPadId(14),
		id: generateRandomPadId(12),
		legend1: "",
		legend2: "",
		defaultViewId: null
	} : undefined;

	const originalPadData = computed(() => props.isCreate ? initialPadData! : client.value.padData as PadData<CRU.CREATE>);

	const padData = ref(cloneDeep(originalPadData.value));

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const isModified = computed(() => !isEqual(padData.value, originalPadData.value));

	watch(() => client.value.padData, (newPadData, oldPadData) => {
		if (!props.isCreate && padData.value && newPadData)
			mergeObject(oldPadData, newPadData, padData.value as PadData);
	}, { deep: true });

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-pad-settings-error`);

		try {
			if(props.isCreate)
				await client.value.createPad(padData.value as PadData<CRU.CREATE>);
			else
				await client.value.editPad(padData.value);
			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-pad-settings-error`, props.isCreate ? i18n.t("pad-settings-dialog.create-map-error") : i18n.t("pad-settings-dialog.save-map-error"), err);
		}
	};

	async function deletePad(): Promise<void> {
		toasts.hideToast(`fm${context.id}-pad-settings-error`);

		if (!await showConfirm({
			title: i18n.t("pad-settings-dialog.delete-map-title"),
			message: i18n.t("pad-settings-dialog.delete-map-message", { name: padData.value.name }),
			variant: "danger",
			okLabel: i18n.t("pad-settings-dialog.delete-map-ok")
		})) {
			return;
		}

		isDeleting.value = true;

		try {
			await client.value.deletePad();
			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-pad-settings-error`, i18n.t("pad-settings-dialog.delete-map-error"), err);
		} finally {
			isDeleting.value = false;
		}
	};
</script>

<template>
	<ModalDialog
		:title="props.isCreate ? i18n.t('pad-settings-dialog.title-create') : i18n.t('pad-settings-dialog.title-edit')"
		class="fm-pad-settings"
		:noCancel="props.noCancel"
		:isBusy="isDeleting"
		:isCreate="props.isCreate"
		:isModified="isModified"
		:okLabel="props.isCreate ? i18n.t('pad-settings-dialog.create-button') : undefined"
		ref="modalRef"
		@submit="$event.waitUntil(save())"
		@hide="emit('hide')"
		@hidden="emit('hidden')"
	>
		<template v-if="padData">
			<PadIdEdit
				:padData="padData"
				idProp="adminId"
				v-model="padData.adminId"
				:label="i18n.t('pad-settings-dialog.admin-link-label')"
				:description="i18n.t('pad-settings-dialog.admin-link-description')"
			></PadIdEdit>

			<PadIdEdit
				:padData="padData"
				idProp="writeId"
				v-model="padData.writeId"
				:label="i18n.t('pad-settings-dialog.write-link-label')"
				:description="i18n.t('pad-settings-dialog.write-link-description')"
			></PadIdEdit>

			<PadIdEdit
				:padData="padData"
				idProp="id"
				v-model="padData.id"
				:label="i18n.t('pad-settings-dialog.read-link-label')"
				:description="i18n.t('pad-settings-dialog.read-link-description')"
			></PadIdEdit>

			<ValidatedField
				class="row mb-3"
				:value="padData.name"
				:validators="[getZodValidator(padDataValidator.update.shape.name)]"
			>
				<template #default="slotProps">
					<label :for="`${id}-pad-name-input`" class="col-sm-3 col-form-label">{{i18n.t("pad-settings-dialog.map-name")}}</label>
					<div class="col-sm-9 position-relative">
						<input
							:id="`${id}-pad-name-input`"
							class="form-control"
							type="text"
							v-model="padData.name"
							:ref="slotProps.inputRef"
						/>
						<div class="invalid-tooltip">
							{{slotProps.validationError}}
						</div>
					</div>
				</template>
			</ValidatedField>

			<div class="row mb-3">
				<label :for="`${id}-search-engines-input`" class="col-sm-3 col-form-label">{{i18n.t("pad-settings-dialog.search-engines")}}</label>
				<div class="col-sm-9">
					<div class="form-check fm-form-check-with-label">
						<input
							:id="`${id}-search-engines-input`"
							class="form-check-input"
							type="checkbox"
							v-model="padData.searchEngines"
						/>
						<label :for="`${id}-search-engines-input`" class="form-check-label">
							{{i18n.t("pad-settings-dialog.search-engines-label")}}
						</label>
					</div>
					<div class="form-text">
						{{i18n.t("pad-settings-dialog.search-engines-description")}}
					</div>
				</div>
			</div>

			<div class="row mb-3">
				<label :for="`${id}-description-input`" class="col-sm-3 col-form-label">{{i18n.t("pad-settings-dialog.map-description")}}</label>
				<div class="col-sm-9">
					<input
						:id="`${id}-description-input`"
						class="form-control"
						type="text"
						v-model="padData.description"
					/>
					<div class="form-text">
						{{i18n.t("pad-settings-dialog.map-description-description")}}
					</div>
				</div>
			</div>

			<div class="row mb-3">
				<label :for="`${id}-cluster-markers-input`" class="col-sm-3 col-form-label">{{i18n.t("pad-settings-dialog.cluster-markers")}}</label>
				<div class="col-sm-9">
					<div class="form-check fm-form-check-with-label">
						<input
							:id="`${id}-cluster-markers-input`"
							class="form-check-input"
							type="checkbox"
							v-model="padData.clusterMarkers"
						/>
						<label :for="`${id}-cluster-markers-input`" class="form-check-label">
							{{i18n.t("pad-settings-dialog.cluster-markers-label")}}
						</label>
					</div>
					<div class="form-text">
						{{i18n.t("pad-settings-dialog.cluster-markers-description")}}
					</div>
				</div>
			</div>

			<div class="row mb-3">
				<label :for="`${id}-legend1-input`" class="col-sm-3 col-form-label">{{i18n.t("pad-settings-dialog.legend-text")}}</label>
				<div class="col-sm-9">
					<textarea
						:id="`${id}-legend1-input`"
						class="form-control"
						type="text"
						v-model="padData.legend1"
					></textarea>
					<textarea
						:id="`${id}-legend2-input`"
						class="form-control mt-1"
						type="text"
						v-model="padData.legend2"
					></textarea>
					<div class="form-text">
						<T k="pad-settings-dialog.legend-text-description">
							<template #markdown>
								<a href="http://commonmark.org/help/" target="_blank">{{i18n.t("pad-settings-dialog.legend-text-description-interpolation-markdown")}}</a>
							</template>
						</T>
					</div>
				</div>
			</div>
		</template>

		<template v-if="padData && !props.isCreate">
			<hr/>

			<div class="row mb-3">
				<label :for="`${id}-delete-input`" class="col-sm-3 col-form-label">{{i18n.t("pad-settings-dialog.delete-map")}}</label>
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
							:disabled="isDeleting || modalRef?.formData?.isSubmitting || deleteConfirmation != expectedDeleteConfirmation"
						>
							<div v-if="isDeleting" class="spinner-border spinner-border-sm"></div>
							{{i18n.t("pad-settings-dialog.delete-map-button")}}
						</button>
					</div>
					<div class="form-text">
						<T k="pad-settings-dialog.delete-description">
							<template #code>
								<code>{{expectedDeleteConfirmation}}</code>
							</template>
						</T>
					</div>
				</div>
			</div>
		</template>
	</ModalDialog>

	<form :id="`${id}-delete-form`" @submit.prevent="deleteConfirmation == expectedDeleteConfirmation && deletePad()">
	</form>
</template>