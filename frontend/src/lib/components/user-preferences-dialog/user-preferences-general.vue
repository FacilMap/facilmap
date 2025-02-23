<script setup lang="ts">
	import { getLocalizedLanguageList } from "facilmap-utils";
	import { Units } from "facilmap-types";
	import { computed } from "vue";
	import {  T, useI18n } from "../../utils/i18n";
	import { getUniqueId } from "../../utils/utils";

	const i18n = useI18n();

	const lang = defineModel<string>("lang", { required: true });
	const units = defineModel<Units>("units", { required: true });

	const id = getUniqueId("fm-user-preferences-general");

	const languageList = computed(() => getLocalizedLanguageList());
</script>

<template>
	<div class="row mb-3">
		<label :for="`${id}-language-input`" class="col-sm-3 col-form-label">{{i18n.t("user-preferences-dialog.language")}}</label>
		<div class="col-sm-9">
			<select :id="`${id}-language-input`" class="form-select" v-model="lang">
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
			<select :id="`${id}-units-input`" class="form-select" v-model="units">
				<option :value="Units.METRIC">{{i18n.t("user-preferences-dialog.units-metric")}}</option>
				<option :value="Units.US_CUSTOMARY">{{i18n.t("user-preferences-dialog.units-us")}}</option>
			</select>
		</div>
	</div>
</template>