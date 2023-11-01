<script setup lang="ts">
import { computed } from 'vue';

	const props = defineProps<{
		modelValue: number | undefined;
		validationError?: string | undefined;
	}>();

	const emit = defineEmits<{
		"update:modelValue": [value: number];
	}>();

	const value = computed({
		get: () => props.modelValue,
		set: (value) => {
			emit("update:modelValue", value!);
		}
	});
</script>

<template>
	<input type="range" class="custom-range" min="1" v-model="value" v-validity="props.validationError" />
	<div class="invalid-feedback" v-if="props.validationError">
		{{props.validationError}}
	</div>
</template>

<style lang="scss">
</style>