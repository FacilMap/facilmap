<script setup lang="ts">
	import type { Stroke } from 'facilmap-types';
	import type { Validator } from './validated-form/validated-field.vue';
	import { computed } from 'vue';
	import { useI18n } from '../../utils/i18n';

	const i18n = useI18n();

	const props = defineProps<{
		modelValue: Stroke;
		id?: string;
		validators?: Array<Validator<Stroke>>;
	}>();

	const emit = defineEmits<{
		"update:modelValue": [stroke: Stroke];
	}>();

	const value = computed({
		get: () => props.modelValue,
		set: (value) => {
			emit("update:modelValue", value!);
		}
	});
</script>

<template>
	<select
		v-model="value"
		class="form-select"
		:id="props.id"
	>
		<option value="">{{i18n.t("stroke-picker.solid")}}</option>
		<option value="dashed">{{i18n.t("stroke-picker.dashed")}}</option>
		<option value="dotted">{{i18n.t("stroke-picker.dotted")}}</option>
	</select>
</template>