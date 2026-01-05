<script setup lang="ts">
	import type { Validator } from "./validated-form/validated-field.vue";
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
		:id="props.id"
		:validators="props.validators"
		class="fm-width-picker"
		:min="1"
	></NumberInput>
</template>