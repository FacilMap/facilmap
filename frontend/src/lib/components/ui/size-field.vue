<script setup lang="ts">
	import { computed } from "vue";
	import vValidity, { vValidityContext } from "./validated-form/validity";
	import vTooltip from "../../utils/tooltip";

	const props = defineProps<{
		modelValue: number | null | undefined;
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
	<div v-validity-context class="fm-size-field">
		<input
			type="range"
			class="custom-range"
			min="15"
			v-model="value"
			v-validity="validationError"
			v-tooltip="value != null ? `${value}` : undefined"
		/>
		<div class="invalid-feedback">
			{{validationError}}
		</div>
	</div>
</template>

<style lang="scss">
	.fm-size-field input {
		width: 100%;
	}
</style>