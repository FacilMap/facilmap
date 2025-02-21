<script setup lang="ts">
	import { getCurrentLanguage, getCurrentUnits, getLocalizedLanguageList } from "facilmap-utils";
	import { Units } from "facilmap-types";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { computed, reactive, ref, toRef } from "vue";
	import {  T, useI18n } from "../utils/i18n";
	import { getUniqueId } from "../utils/utils";
	import { setLangCookie, setUnitsCookie } from "../utils/cookies";
	import { isEqual, xor } from "lodash-es";
	import { injectContextRequired, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import DropdownMenu from "./ui/dropdown-menu.vue";
	import { defaultVisibleLayers, getLayers } from "facilmap-leaflet";
import storage from "../utils/storage";

	const i18n = useI18n();
	const context = injectContextRequired();
	const client = toRef(() => context?.components.client);
	const mapContext = requireMapContext(context);

	const emit = defineEmits<{
		hidden: [];
	}>();

	const modalRef = ref<InstanceType<typeof ModalDialog>>();
	const id = getUniqueId("fm-user-preferences-dialog");

	const activeTab = ref(0);

	const initialValues = {
		lang: getCurrentLanguage(),
		units: getCurrentUnits(),
		baseLayer: storage.baseLayer ?? defaultVisibleLayers.baseLayer,
		overlays: [...storage.overlays ?? defaultVisibleLayers.overlays]
	};

	const values = reactive({ ...initialValues });

	const isModified = computed(() => {
		return !isEqual(values, reactive(initialValues));
	});

	const languageList = computed(() => getLocalizedLanguageList());

	const baseLayers = computed(() => {
		const { baseLayers } = getLayers(mapContext.value.components.map);
		return Object.keys(baseLayers).map((key) => ({
			key,
			name: baseLayers[key].options.fmGetName!()
		}));
	});

	const overlays = computed(() => {
		const { overlays } = getLayers(mapContext.value.components.map);
		return Object.keys(overlays).map((key) => ({
			key,
			name: overlays[key].options.fmGetName?.() ?? overlays[key].options.fmName!
		}));
	});

	const selectedLayersLabel = computed(() => [
		...baseLayers.value.filter((l) => values.baseLayer === l.key),
		...overlays.value.filter((l) => values.overlays.includes(l.key))
	].map((l) => l.name).join("; "));

	async function save() {
		storage.baseLayer = values.baseLayer;
		storage.overlays = values.overlays;

		await setLangCookie(values.lang);
		await setUnitsCookie(values.units);

		if (client.value) {
			await client.value.setLanguage({
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
		@submit="save"
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
			<div class="row mb-3">
				<label :for="`${id}-language-input`" class="col-sm-3 col-form-label">{{i18n.t("user-preferences-dialog.language")}}</label>
				<div class="col-sm-9">
					<select :id="`${id}-language-input`" class="form-select" v-model="values.lang">
						<option v-for="(label, key) in languageList" :key="key" :value="key">{{label}}</option>
					</select>
					<div class="form-text">
						<T k="user-preferences-dialog.language-description">
							<template #weblate>
								<a href="https://hosted.weblate.org/projects/facilmap/" target="_blank" rel="noopener">
									{{i18n.t("user-preferences-dialog.language-description-interpolation-weblate")}}
								</a>
							</template>
						</T>
					</div>
				</div>
			</div>

			<div class="row mb-3">
				<label :for="`${id}-units-input`" class="col-sm-3 col-form-label">{{i18n.t("user-preferences-dialog.units")}}</label>
				<div class="col-sm-9">
					<select :id="`${id}-units-input`" class="form-select" v-model="values.units">
						<option :value="Units.METRIC">{{i18n.t("user-preferences-dialog.units-metric")}}</option>
						<option :value="Units.US_CUSTOMARY">{{i18n.t("user-preferences-dialog.units-us")}}</option>
					</select>
				</div>
			</div>
		</template>

		<template v-else-if="activeTab === 1">
			<div class="row mb-3">
				<label class="col-sm-3 col-form-label">{{i18n.t("user-preferences-dialog.default-map-style")}}</label>

				<DropdownMenu :label="selectedLayersLabel" class="col-sm-9">
					<li v-for="layerInfo in baseLayers" :key="layerInfo.key">
						<a
							class="dropdown-item"
							:class="{ active: values.baseLayer === layerInfo.key }"
							href="javascript:"
							@click.capture.stop="values.baseLayer = layerInfo.key"
							draggable="false"
						>{{layerInfo.name}}</a>
					</li>

					<li v-if="baseLayers.length > 0 && overlays.length > 0">
						<hr class="dropdown-divider">
					</li>

					<li v-for="layerInfo in overlays" :key="layerInfo.key">
						<a
							class="dropdown-item"
							:class="{ active: values.overlays.includes(layerInfo.key) }"
							href="javascript:"
							@click.capture.stop="values.overlays = xor(values.overlays, [layerInfo.key])"
							draggable="false"
						>{{layerInfo.name}}</a>
					</li>
				</DropdownMenu>
			</div>
		</template>
	</ModalDialog>
</template>