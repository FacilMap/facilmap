<script setup lang="ts">
	import { computed } from "vue";
	import vValidity from "./validated-form/validity";

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

	const validationError = computed(() => {
		if (props.validationError) {
			return props.validationError;
		} else {
			return undefined;
		}
	});
</script>

<template>
	<input type="range" class="custom-range" min="15" v-model="value" v-validity="validationError" />
	<div class="invalid-feedback" v-if="validationError">
		{{validationError}}
	</div>
</template>

<style lang="scss">
</style>