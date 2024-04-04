<script setup lang="ts">
	import { LANGUAGES, getCurrentLanguage } from "facilmap-utils";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { computed, reactive, ref, toRef } from "vue";
	import {  useI18n } from "../utils/i18n";
	import { getUniqueId } from "../utils/utils";
	import { setLangCookie } from "../utils/cookies";
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
		lang: getCurrentLanguage()
	};

	const values = reactive({ ...initialValues });

	const isModified = computed(() => {
		return !isEqual(values, reactive(initialValues));
	});

	async function save() {
		await setLangCookie(values.lang);

		if (client.value) {
			await client.value.setLanguage({ lang: values.lang });
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
	</ModalDialog>
</template>