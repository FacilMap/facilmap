<script setup lang="ts">
	import { computed } from "vue";
	import vValidity, { vValidityContext } from "./validated-form/validity";
	import vTooltip from "../../utils/tooltip";

	const props = defineProps<{
		modelValue: number | undefined | null;
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
	<div v-validity-context>
		<input
			type="range"
			class="custom-range"
			min="1"
			v-model="value"
			v-validity="props.validationError"
			v-tooltip="value != null ? `${value}` : undefined"
		/>
		<div class="invalid-feedback">
			{{props.validationError}}
		</div>
	</div>
</template>

<style lang="scss">
</style>