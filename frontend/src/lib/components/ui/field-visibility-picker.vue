<script setup lang="ts">
	import type { FieldType, FieldVisibility } from "facilmap-types";
	import { useI18n } from "../../utils/i18n";
	import { computed } from "vue";

	const i18n = useI18n();

	const props = defineProps<{
		fieldType: FieldType;
	}>();

	const modelValue = defineModel<FieldVisibility>({ required: true });
	const value = computed({
		get: () => props.fieldType !== "formula" && modelValue.value === "view" ? undefined : modelValue.value,
		set: (v) => {
			modelValue.value = v;
		}
	});
</script>

<template>
	<select class="form-select" v-model="value">
		<option :value="undefined">{{i18n.t("field-visibility-picker.always")}}</option>
		<option value="view" v-if="props.fieldType === 'formula'">{{i18n.t("field-visibility-picker.view")}}</option>
		<option value="edit">{{i18n.t("field-visibility-picker.edit")}}</option>
	</select>
</template>