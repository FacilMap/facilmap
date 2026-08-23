<script setup lang="ts">
	import { computed, ref, watch } from "vue";
	import { type CRU, type MapData } from "facilmap-types";
	import { generateRandomMapId, mergeObject } from "facilmap-utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";
	import MapSettingsGeneral from "./map-settings-general.vue";
	import MapSettingsDelete from "./map-settings-delete.vue";
	import MapSettingsFormulas from "./map-settings-formulas.vue";
	import MapSettingsAdvanced from "./map-settings-advanced.vue";

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

	const isDeleting = ref(false);
	const activeTab = ref(0);

	function random(id: "admin" | "write" | "read") {
		return generateRandomMapId(id === "admin" ? 16 : id === "write" ? 14 : 12);
	}

	const initialMapData: MapData<CRU.CREATE> | undefined = props.isCreate ? {
		name: "",
		searchEngines: false,
		description: "",
		clusterMarkers: false,
		adminId: (props.proposedAdminId || random("admin")),
		writeId: random("write"),
		id: random("read"),
		legend1: "",
		legend2: "",
		routeFormulas: [],
		defaultViewId: null
	} : undefined;

	const originalMapData = computed(() => props.isCreate ? initialMapData! : client.value.mapData as MapData<CRU.CREATE>);

	const mapData = ref(cloneDeep(originalMapData.value));

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const isModified = computed(() => !isEqual(mapData.value, originalMapData.value));

	watch(() => client.value.mapData, (newMapData, oldMapData) => {
		if (!props.isCreate && mapData.value && newMapData)
			mergeObject(oldMapData, newMapData, mapData.value as MapData);
	}, { deep: true });

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-map-settings-error`);

		try {
			if(props.isCreate)
				await client.value.createMap(mapData.value as MapData<CRU.CREATE>);
			else
				await client.value.editMap(mapData.value);
			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-map-settings-error`, () => (props.isCreate ? i18n.t("map-settings-dialog.create-map-error") : i18n.t("map-settings-dialog.save-map-error")), err);
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
			<ul class="nav nav-tabs mb-2">
				<li class="nav-item">
					<a class="nav-link" :class="{ active: activeTab === 0 }" aria-current="page" href="javascript:" @click="activeTab = 0">
						{{i18n.t("map-settings-dialog.tab-general")}}
					</a>
				</li>

				<li class="nav-item">
					<a class="nav-link" :class="{ active: activeTab === 1 }" aria-current="page" href="javascript:" @click="activeTab = 1">
						{{i18n.t("map-settings-dialog.tab-formulas")}}
					</a>
				</li>

				<li class="nav-item">
					<a class="nav-link" :class="{ active: activeTab === 2 }" aria-current="page" href="javascript:" @click="activeTab = 2">
						{{i18n.t("map-settings-dialog.tab-advanced")}}
					</a>
				</li>

				<li v-if="!props.isCreate" class="nav-item">
					<a class="nav-link" :class="{ active: activeTab === 3 }" aria-current="page" href="javascript:" @click="activeTab = 3">
						{{i18n.t("map-settings-dialog.tab-delete-map")}}
					</a>
				</li>
			</ul>

			<div v-show="activeTab === 0" @invalid.capture="activeTab = 0">
				<MapSettingsGeneral
					:mapData="mapData"
				></MapSettingsGeneral>
			</div>

			<div v-show="activeTab === 1" @invalid.capture="activeTab = 1">
				<MapSettingsFormulas
					:mapData="mapData"
				></MapSettingsFormulas>
			</div>

			<div v-show="activeTab === 2" @invalid.capture="activeTab = 2">
				<MapSettingsAdvanced
					:mapData="mapData"
				></MapSettingsAdvanced>
			</div>

			<div v-show="activeTab === 3" @invalid.capture="activeTab = 3">
				<MapSettingsDelete
					:mapData="mapData"
					:isSubmitting="modalRef?.formData?.isSubmitting"
					@update:isDeleting="isDeleting = $event"
					@deleted="modalRef?.modal.hide()"
				></MapSettingsDelete>
			</div>
		</template>
	</ModalDialog>
</template>