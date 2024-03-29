<script setup lang="ts">
	import { computed } from "vue";
	import vTooltip from "../../utils/tooltip";
	import type { Validator } from "./validated-form/validated-field.vue";
	import ValidatedField from "./validated-form/validated-field.vue";

	const props = defineProps<{
		modelValue: number;
		validators?: Array<Validator<number>>;
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
	<ValidatedField
		:value="value"
		:validators="props.validators"
		class="fm-width-picker position-relative"
	>
		<template #default="slotProps">
			<input
				type="range"
				class="custom-range"
				min="1"
				v-model.number="value"
				:ref="slotProps.inputRef"
				v-tooltip="`${value}`"
			/>
			<div class="invalid-tooltip">
				{{slotProps.validationError}}
			</div>
		</template>
	</ValidatedField>
</template>

<style lang="scss">
	.fm-width-picker input {
		width: 100%;
	}
</style>