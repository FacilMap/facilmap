<script setup lang="ts">
	import { type Validator } from "./validated-form/validated-field.vue";
	import NumberInput from "./number-input.vue";

	const props = defineProps<{
		id?: string;
		validators?: Array<Validator<number>>;
	}>();

	const value = defineModel<number>({ required: true });
</script>

<template>
	<NumberInput
		v-model="value"
		class="fm-size-picker"
		:id="props.id"
		:min="15"
		:steps="[1, 5]"
		:validators="props.validators"
	></NumberInput>
</template>