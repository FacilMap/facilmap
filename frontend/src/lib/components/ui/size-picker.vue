<script setup lang="ts">
	import { computed } from "vue";
	import vTooltip from "../../utils/tooltip";
	import ValidatedField, { type Validator } from "./validated-form/validated-field.vue";

	const props = defineProps<{
		modelValue: number | null | undefined;
		validators?: Array<Validator<number | null | undefined>>;
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
		class="fm-size-picker position-relative"
		:value="value"
		:validators="props.validators"
	>
		<template #default="slotProps">
			<input
				type="range"
				class="custom-range"
				min="15"
				v-model.number="value"
				:ref="slotProps.inputRef"
				v-tooltip="value != null ? `${value}` : undefined"
			/>
			<div class="invalid-tooltip">
				{{slotProps.validationError}}
			</div>
		</template>
	</ValidatedField>
</template>

<style lang="scss">
	.fm-size-picker input {
		width: 100%;
	}
</style>