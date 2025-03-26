<script setup lang="ts">
	import { getCurrentLanguage, getCurrentUnits } from "facilmap-utils";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { computed, reactive, ref, toRef } from "vue";
	import {  useI18n } from "../../utils/i18n";
	import { setLangCookie, setUnitsCookie } from "../../utils/cookies";
	import { cloneDeep, isEqual } from "lodash-es";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { defaultVisibleLayers } from "facilmap-leaflet";
	import storage from "../../utils/storage";
	import { getExternalLinksSetting, setExternalLinksSetting } from "../../utils/external-links";
	import UserPreferencesGeneral from "./user-preferences-general.vue";
	import UserPreferencesMapStyle from "./user-preferences-map-style.vue";

	const i18n = useI18n();
	const context = injectContextRequired();
	const client = toRef(() => context?.components.client);

	const emit = defineEmits<{
		hidden: [];
	}>();

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const activeTab = ref(0);

	const initialValues = {
		lang: getCurrentLanguage(),
		units: getCurrentUnits(),
		baseLayer: storage.baseLayer ?? defaultVisibleLayers.baseLayer,
		overlays: [...storage.overlays ?? defaultVisibleLayers.overlays],
		externalLinks: getExternalLinksSetting()
	};

	const values = reactive(cloneDeep(initialValues));

	const isModified = computed(() => {
		return !isEqual(values, reactive(initialValues));
	});

	async function save() {
		storage.baseLayer = values.baseLayer;
		storage.overlays = values.overlays;

		setExternalLinksSetting(values.externalLinks);

		await setLangCookie(values.lang);
		await setUnitsCookie(values.units);

		if (client.value) {
			await client.value.client.setLanguage({
				lang: values.lang,
				units: values.units
			});
		}

		await i18n.changeLanguage(values.lang);

		modalRef.value?.modal.hide();
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('user-preferences-dialog.title')"
		class="fm-user-preferences"
		:isModified="isModified"
		@submit="$event.waitUntil(save())"
		ref="modalRef"
		@hidden="emit('hidden')"
	>
		<p>{{i18n.t("user-preferences-dialog.introduction")}}</p>

		<ul class="nav nav-tabs mb-2">
			<li class="nav-item">
				<a class="nav-link" :class="{ active: activeTab === 0 }" aria-current="page" href="javascript:" @click="activeTab = 0">
					{{i18n.t("user-preferences-dialog.tab-general")}}
				</a>
			</li>

			<li class="nav-item">
				<a class="nav-link" :class="{ active: activeTab === 1 }" aria-current="page" href="javascript:" @click="activeTab = 1">
					{{i18n.t("user-preferences-dialog.tab-map-style")}}
				</a>
			</li>
		</ul>

		<template v-if="activeTab === 0">
			<UserPreferencesGeneral
				v-model:lang="values.lang"
				v-model:units="values.units"
			/>
		</template>

		<template v-else-if="activeTab === 1">
			<UserPreferencesMapStyle
				v-model:baseLayer="values.baseLayer"
				v-model:overlays="values.overlays"
				v-model:externalLinks="values.externalLinks"
			/>
		</template>
	</ModalDialog>
</template>