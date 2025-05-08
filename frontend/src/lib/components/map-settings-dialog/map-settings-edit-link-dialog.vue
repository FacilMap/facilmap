<script setup lang="ts">
	import { computed, ref, watch } from "vue";
	import { type CRU, type MapData, type MapLink, type MergedUnion } from "facilmap-types";
	import { mergeObject } from "facilmap-utils";
	import { getUniqueId } from "../../utils/utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { useI18n } from "../../utils/i18n";
	import MapSlugEdit from "./map-slug-edit.vue";
	import MapPasswordEdit from "./map-password-edit.vue";
	import MapPermissionsEdit from "./map-permissions-edit.vue";

	const i18n = useI18n();

	const props = defineProps<{
		mapData: MergedUnion<[MapData<CRU.CREATE>, Required<MapData<CRU.UPDATE>>]>;
		isCreate?: boolean;
	}>();

	const emit = defineEmits<{
		hide: [];
		hidden: [];
	}>();

	const mapLinkModel = defineModel<MapLink<CRU.CREATE | CRU.UPDATE>>("mapLink", { required: true });

	const id = getUniqueId("fm-map-settings-edit-link");

	const mapLink = ref(cloneDeep(mapLinkModel.value));

	const updatedMapData = computed(() => ({
		...props.mapData,
		links: (
			props.isCreate ? [...props.mapData.links, mapLink.value] :
			props.mapData.links.map((l) => l === mapLinkModel.value ? mapLink.value : l)
		)
	}));

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const initialPassword2 = typeof mapLink.value.password === "string" ? mapLink.value.password : "";
	const password2 = ref(initialPassword2);

	const isModified = computed(() => !isEqual(mapLink.value, mapLinkModel.value) || password2.value !== initialPassword2);

	watch(mapLinkModel, (newMapLink, oldMapLink) => {
		mergeObject(oldMapLink, newMapLink, mapLink.value);
	}, { deep: true });

	function save(): void {
		mapLinkModel.value = cloneDeep(mapLink.value);
		modalRef.value?.modal.hide();
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('map-settings-edit-link-dialog.title')"
		class="fm-map-settings-edit-link"
		:isModified="isModified"
		:isCreate="props.isCreate"
		ref="modalRef"
		:okLabel="isModified ? i18n.t('common.ok') : undefined"
		@submit="save()"
		@hide="emit('hide')"
		@hidden="emit('hidden')"
	>
		<div class="row mb-3">
			<label :for="`${id}-slug-input`" class="col-sm-3 col-form-label text-break">{{i18n.t("map-settings-edit-link-dialog.comment")}}</label>
			<div class="col-sm-9 position-relative">
				<input type="text" class="form-control" v-model="mapLink.comment" />
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-slug-input`" class="col-sm-3 col-form-label text-break">{{i18n.t("map-settings-edit-link-dialog.url")}}</label>
			<div class="col-sm-9 position-relative">
				<MapSlugEdit
					:mapData="updatedMapData"
					v-model="mapLink.slug"
					:updatesMapData="false"
				></MapSlugEdit>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-slug-input`" class="col-sm-3 col-form-label text-break">{{i18n.t("map-settings-edit-link-dialog.password")}}</label>
			<div class="col-sm-9 d-flex">
				<MapPasswordEdit
					v-model:password="mapLink.password"
					v-model:password2="password2"
					:originalPassword="typeof mapLinkModel.password === 'string' ? undefined : mapLinkModel.password"
				></MapPasswordEdit>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-slug-input`" class="col-sm-3 col-form-label text-break">{{i18n.t("map-settings-edit-link-dialog.permissions")}}</label>
			<div class="col-sm-9">
				<MapPermissionsEdit
					v-model:permissions="mapLink.permissions"
				></MapPermissionsEdit>
			</div>
		</div>
	</ModalDialog>
</template>