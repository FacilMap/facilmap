<script setup lang="ts">
	import { LANGUAGES, getCurrentLanguage, getCurrentUnits } from "facilmap-utils";
	import { Units } from "facilmap-types";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { computed, reactive, ref, toRef } from "vue";
	import {  useI18n } from "../utils/i18n";
	import { getUniqueId } from "../utils/utils";
	import { setLangCookie, setUnitsCookie } from "../utils/cookies";
	import { isEqual } from "lodash-es";
	import { injectContextOptional } from "./facil-map-context-provider/facil-map-context-provider.vue";

	const i18n = useI18n();
	const context = injectContextOptional();
	const client = toRef(() => context?.components.client);

	const emit = defineEmits<{
		hidden: [];
	}>();

	const modalRef = ref<InstanceType<typeof ModalDialog>>();
	const id = getUniqueId("fm-user-preferences-dialog");

	const initialValues = {
		lang: getCurrentLanguage(),
		units: getCurrentUnits()
	};

	const values = reactive({ ...initialValues });

	const isModified = computed(() => {
		return !isEqual(values, reactive(initialValues));
	});

	async function save() {
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

		<div class="row mb-3">
			<label :for="`${id}-language-input`" class="col-sm-3 col-form-label">{{i18n.t("user-preferences-dialog.language")}}</label>
			<div class="col-sm-9">
				<select :id="`${id}-language-input`" class="form-select" v-model="values.lang">
					<option v-for="(label, key) in LANGUAGES" :key="key" :value="key">{{label}}</option>
				</select>
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
	</ModalDialog>
</template>