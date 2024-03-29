<script setup lang="ts">
	import type { Stroke } from 'facilmap-types';
	import type { Validator } from './validated-form/validated-field.vue';
	import { computed } from 'vue';

	const props = defineProps<{
		modelValue: Stroke;
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
	>
		<option value="">Solid</option>
		<option value="dashed">Dashed</option>
		<option value="dotted">Dotted</option>
	</select>
</template>