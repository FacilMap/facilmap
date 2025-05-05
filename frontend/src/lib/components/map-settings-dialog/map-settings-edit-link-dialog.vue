<script setup lang="ts">
	import { computed, ref, watch } from "vue";
	import { type CRU, type MapData, type MapLink } from "facilmap-types";
	import { mergeObject } from "facilmap-utils";
	import { getUniqueId } from "../../utils/utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { injectContextRequired, requireClientContext, requireClientSub } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";
	import MapSlugEdit from "./map-slug-edit.vue";
	import MapPasswordEdit from "./map-password-edit.vue";
	import MapPermissionsEdit from "./map-permissions-edit.vue";

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = requireClientSub(context);

	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		mapData: MapData<CRU.CREATE> | Required<MapData<CRU.UPDATE>>;
	}>();

	const emit = defineEmits<{
		hide: [];
		hidden: [];
	}>();

	const mapLinkModel = defineModel<MapLink<CRU.CREATE | CRU.UPDATE>>("mapLink", { required: true });

	const id = getUniqueId("fm-map-settings-edit-link");

	const mapLink = ref(cloneDeep(mapLinkModel.value));

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const isModified = computed(() => !isEqual(mapLink.value, mapLinkModel.value));

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
		ref="modalRef"
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
					:mapData="props.mapData"
					v-model="mapLink.slug"
				></MapSlugEdit>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-slug-input`" class="col-sm-3 col-form-label text-break">{{i18n.t("map-settings-edit-link-dialog.password")}}</label>
			<div class="col-sm-9 d-flex">
				<MapPasswordEdit
					v-model:password="mapLink.password"
					:originalPassword="mapLinkModel.password"
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