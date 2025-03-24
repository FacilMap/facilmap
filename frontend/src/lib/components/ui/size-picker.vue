<script setup lang="ts">
	import { computed } from "vue";
	import vTooltip from "../../utils/tooltip";
	import ValidatedField, { type Validator } from "./validated-form/validated-field.vue";

	const props = defineProps<{
		modelValue: number;
		id?: string;
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
		class="fm-size-picker position-relative"
		:value="value"
		:validators="props.validators"
	>
		<template #default="slotProps">
			<input
				type="range"
				class="custom-range"
				min="15"
				:id="props.id"
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
	.fm-size-picker input {
		width: 100%;
	}
</style>