<script setup lang="ts">
	import { computed, ref, watch } from "vue";
	import { mapDataValidator, type CRU, type MapData, type MapDataWithWritable } from "facilmap-types";
	import { generateRandomMapSlug, mergeObject } from "facilmap-utils";
	import { getUniqueId, getZodValidator } from "../../utils/utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";
	import MapSlugEdit from "./map-slug-edit.vue";
	import { getClientSub, injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "../ui/validated-form/validated-field.vue";
	import { T, useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = getClientSub(context);

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

	const id = getUniqueId("fm-map-settings");
	const isDeleting = ref(false);
	const deleteConfirmation = ref("");
	const expectedDeleteConfirmation = computed(() => i18n.t('map-settings-dialog.delete-code'));

	const initialMapData: MapData<CRU.CREATE> | undefined = props.isCreate ? {
		name: "",
		searchEngines: false,
		description: "",
		clusterMarkers: false,
		adminId: (props.proposedAdminId || generateRandomMapSlug(16)),
		writeId: generateRandomMapSlug(14),
		readId: generateRandomMapSlug(12),
		legend1: "",
		legend2: "",
		defaultViewId: null
	} : undefined;

	const originalMapData = computed(() => {
		if (props.isCreate) {
			return initialMapData!;
		} else if (clientSub.value) {
			return clientSub.value.data.mapData as MapData<CRU.CREATE>;
		} else {
			throw new Error("No map is currently open.");
		}
	});

	const mapData = ref(cloneDeep(originalMapData.value));

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const isModified = computed(() => !isEqual(mapData.value, originalMapData.value));

	watch(originalMapData, (newMapData, oldMapData) => {
		if (mapData.value && newMapData)
			mergeObject<MapDataWithWritable | MapData<CRU.CREATE>>(oldMapData, newMapData, mapData.value);
	}, { deep: true });

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-map-settings-error`);

		try {
			if (props.isCreate) {
				await clientContext.value.createAndOpenMap(mapData.value as MapData<CRU.CREATE>);
			} else {
				await clientContext.value.client.updateMap(clientSub.value!.mapSlug, mapData.value);
			}
			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-map-settings-error`, () => (props.isCreate ? i18n.t("map-settings-dialog.create-map-error") : i18n.t("map-settings-dialog.save-map-error")), err);
		}
	};

	async function deleteMap(): Promise<void> {
		toasts.hideToast(`fm${context.id}-map-settings-error`);

		if (!await showConfirm({
			title: i18n.t("map-settings-dialog.delete-map-title"),
			message: i18n.t("map-settings-dialog.delete-map-message", { name: mapData.value.name }),
			variant: "danger",
			okLabel: i18n.t("map-settings-dialog.delete-map-ok")
		})) {
			return;
		}

		isDeleting.value = true;

		try {
			await clientContext.value.client.deleteMap(clientSub.value!.mapSlug);
			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-map-settings-error`, () => i18n.t("map-settings-dialog.delete-map-error"), err);
		} finally {
			isDeleting.value = false;
		}
	};
</script>

<template>
	<ModalDialog
		:title="props.isCreate ? i18n.t('map-settings-dialog.title-create') : i18n.t('map-settings-dialog.title-edit')"
		class="fm-map-settings fm-pad-settings"
		:noCancel="props.noCancel"
		:isBusy="isDeleting"
		:isCreate="props.isCreate"
		:isModified="isModified"
		:okLabel="props.isCreate ? i18n.t('map-settings-dialog.create-button') : undefined"
		ref="modalRef"
		@submit="$event.waitUntil(save())"
		@hide="emit('hide')"
		@hidden="emit('hidden')"
	>
		<template v-if="mapData">
			<MapSlugEdit
				:mapData="mapData"
				idProp="adminId"
				v-model="mapData.adminId"
				:label="i18n.t('map-settings-dialog.admin-link-label')"
				:description="i18n.t('map-settings-dialog.admin-link-description')"
			></MapSlugEdit>

			<MapSlugEdit
				:mapData="mapData"
				idProp="writeId"
				v-model="mapData.writeId"
				:label="i18n.t('map-settings-dialog.write-link-label')"
				:description="i18n.t('map-settings-dialog.write-link-description')"
			></MapSlugEdit>

			<MapSlugEdit
				:mapData="mapData"
				idProp="readId"
				v-model="mapData.readId"
				:label="i18n.t('map-settings-dialog.read-link-label')"
				:description="i18n.t('map-settings-dialog.read-link-description')"
			></MapSlugEdit>

			<ValidatedField
				class="row mb-3"
				:value="mapData.name"
				:validators="[getZodValidator(mapDataValidator.update.shape.name)]"
			>
				<template #default="slotProps">
					<label :for="`${id}-map-name-input`" class="col-sm-3 col-form-label">{{i18n.t("map-settings-dialog.map-name")}}</label>
					<div class="col-sm-9 position-relative">
						<input
							:id="`${id}-map-name-input`"
							class="form-control"
							type="text"
							v-model="mapData.name"
							:ref="slotProps.inputRef"
						/>
						<div class="invalid-tooltip">
							{{slotProps.validationError}}
						</div>
					</div>
				</template>
			</ValidatedField>

			<div class="row mb-3">
				<label :for="`${id}-search-engines-input`" class="col-sm-3 col-form-label">{{i18n.t("map-settings-dialog.search-engines")}}</label>
				<div class="col-sm-9">
					<div class="form-check fm-form-check-with-label">
						<input
							:id="`${id}-search-engines-input`"
							class="form-check-input"
							type="checkbox"
							v-model="mapData.searchEngines"
						/>
						<label :for="`${id}-search-engines-input`" class="form-check-label">
							{{i18n.t("map-settings-dialog.search-engines-label")}}
						</label>
					</div>
					<div class="form-text">
						{{i18n.t("map-settings-dialog.search-engines-description")}}
					</div>
				</div>
			</div>

			<div class="row mb-3">
				<label :for="`${id}-description-input`" class="col-sm-3 col-form-label">{{i18n.t("map-settings-dialog.map-description")}}</label>
				<div class="col-sm-9">
					<input
						:id="`${id}-description-input`"
						class="form-control"
						type="text"
						v-model="mapData.description"
					/>
					<div class="form-text">
						{{i18n.t("map-settings-dialog.map-description-description")}}
					</div>
				</div>
			</div>

			<div class="row mb-3">
				<label :for="`${id}-cluster-markers-input`" class="col-sm-3 col-form-label">{{i18n.t("map-settings-dialog.cluster-markers")}}</label>
				<div class="col-sm-9">
					<div class="form-check fm-form-check-with-label">
						<input
							:id="`${id}-cluster-markers-input`"
							class="form-check-input"
							type="checkbox"
							v-model="mapData.clusterMarkers"
						/>
						<label :for="`${id}-cluster-markers-input`" class="form-check-label">
							{{i18n.t("map-settings-dialog.cluster-markers-label")}}
						</label>
					</div>
					<div class="form-text">
						{{i18n.t("map-settings-dialog.cluster-markers-description")}}
					</div>
				</div>
			</div>

			<div class="row mb-3">
				<label :for="`${id}-legend1-input`" class="col-sm-3 col-form-label">{{i18n.t("map-settings-dialog.legend-text")}}</label>
				<div class="col-sm-9">
					<textarea
						:id="`${id}-legend1-input`"
						class="form-control"
						v-model="mapData.legend1"
					></textarea>
					<textarea
						:id="`${id}-legend2-input`"
						class="form-control mt-1"
						v-model="mapData.legend2"
					></textarea>
					<div class="form-text">
						<T k="map-settings-dialog.legend-text-description">
							<template #markdown>
								<a href="http://commonmark.org/help/" target="_blank">{{i18n.t("map-settings-dialog.legend-text-description-interpolation-markdown")}}</a>
							</template>
						</T>
					</div>
				</div>
			</div>
		</template>

		<template v-if="mapData && !props.isCreate">
			<hr/>

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
							:disabled="isDeleting || modalRef?.formData?.isSubmitting || deleteConfirmation != expectedDeleteConfirmation"
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
		</template>
	</ModalDialog>

	<form :id="`${id}-delete-form`" @submit.prevent="deleteConfirmation == expectedDeleteConfirmation && deleteMap()">
	</form>
</template>