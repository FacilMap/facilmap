<script setup lang="ts">
	import { computed, ref, watch } from "vue";
	import { ADMIN_LINK_COMMENT, getMainAdminLink, type CRU, type MapData, type MergedUnion } from "facilmap-types";
	import { deI18nMapLinkComments, generateRandomMapSlug, i18nMapLinkComments } from "facilmap-utils";
	import { getUniqueId } from "../../utils/utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { getClientSub, injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";
	import storage, { storagePersisted } from "../../utils/storage";
	import vTooltip from "../../utils/tooltip";
	import Icon from "../ui/icon.vue";
	import MapSettingsGeneral from "./map-settings-general.vue";
	import MapSettingsLinks from "./map-settings-links.vue";
	import MapSettingsDelete from "./map-settings-delete.vue";
	import { mergeMapData } from "./map-settings-utils";

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
	const activeTab = ref(0);

	const addFavourite = ref(true);

	const initialMapData: MapData<CRU.CREATE> | undefined = props.isCreate ? {
		name: "",
		description: "",
		clusterMarkers: false,
		links: i18nMapLinkComments([
			{
				slug: generateRandomMapSlug(),
				comment: ADMIN_LINK_COMMENT,
				password: false,
				searchEngines: false,
				permissions: {
					read: true,
					update: true,
					settings: true,
					admin: true
				}
			}
		]),
		legend1: "",
		legend2: "",
		defaultViewId: null
	} : undefined;

	const originalMapData = computed<MergedUnion<[MapData<CRU.CREATE>, Required<MapData<CRU.UPDATE>>]>>(() => {
		if (props.isCreate) {
			return initialMapData!;
		} else if (clientSub.value) {
			return {
				...clientSub.value.data.mapData,
				links: i18nMapLinkComments(clientSub.value.data.mapData.links)
			};
		} else {
			throw new Error("No map is currently open.");
		}
	});

	const mapData = ref(cloneDeep(originalMapData.value));

	const adminLink = computed(() => getMainAdminLink(mapData.value.links));

	const canDelete = computed(() => !props.isCreate && !!clientSub.value?.data.mapData.activeLink.permissions.admin);

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const isModified = computed(() => !isEqual(mapData.value, originalMapData.value));

	watch(originalMapData, (newMapData, oldMapData) => {
		if (mapData.value && newMapData)
			mergeMapData(oldMapData, newMapData, mapData.value);
	}, { deep: true });

	const hasFavourite = computed(() => storage.favourites.some((f) => f.mapSlug === adminLink.value.slug));

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-map-settings-error`);

		try {
			const data = {
				...mapData.value,
				links: deI18nMapLinkComments(mapData.value.links)
			};
			if (props.isCreate) {
				await clientContext.value.createAndOpenMap(data as MapData<CRU.CREATE>);
				if (addFavourite.value && !hasFavourite.value) {
					storage.favourites.push({ mapSlug: clientSub.value!.mapSlug, name: clientSub.value!.data.mapData.name, mapId: clientSub.value!.data.mapData.id });
				}
			} else {
				await clientContext.value.client.updateMap(clientSub.value!.mapSlug, data);
			}
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
						{{i18n.t("map-settings-dialog.tab-map-links")}}
					</a>
				</li>

				<li v-if="canDelete" class="nav-item">
					<a class="nav-link" :class="{ active: activeTab === 2 }" aria-current="page" href="javascript:" @click="activeTab = 2">
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
				<MapSettingsLinks
					:mapData="mapData"
				></MapSettingsLinks>
			</div>

			<div v-show="activeTab === 2" @invalid.capture="activeTab = 2">
				<MapSettingsDelete
					:mapData="mapData"
					:isSubmitting="modalRef?.formData?.isSubmitting"
					@update:isDeleting="isDeleting = $event"
					@deleted="modalRef?.modal.hide()"
				></MapSettingsDelete>
			</div>
		</template>

		<template #footer-left v-if="props.isCreate && !hasFavourite">
			<div class="form-check">
				<input
					:id="`${id}-add-favourite-input`"
					class="form-check-input"
					type="checkbox"
					v-model="addFavourite"
				/>
				<label :for="`${id}-add-favourite-input`" class="form-check-label">
					{{storagePersisted ? i18n.t("map-settings-dialog.add-favourite") : i18n.t("map-settings-dialog.add-favourite-persist")}}
				</label>
				{{" "}}
				<Icon icon="question-sign" v-tooltip="i18n.t('map-settings-dialog.add-favourite-tooltip')"></Icon>
			</div>
		</template>
	</ModalDialog>
</template>