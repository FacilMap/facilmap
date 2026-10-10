<script setup lang="ts">
	import type { FieldType } from "facilmap-types";
	import { useI18n } from "../../utils/i18n";

	const i18n = useI18n();

	const value = defineModel<FieldType>({ required: true })
</script>

<template>
	<select class="form-select" v-model="value">
		<option value="input">{{i18n.t("field-type-picker.input")}}</option>
		<option value="textarea">{{i18n.t("field-type-picker.textarea")}}</option>
		<option value="dropdown">{{i18n.t("field-type-picker.dropdown")}}</option>
		<option value="checkbox">{{i18n.t("field-type-picker.checkbox")}}</option>
		<option value="formula">{{i18n.t("field-type-picker.formula")}}</option>
	</select>
</template>