<script setup lang="ts" generic="T">
	import { readonly, reactive, toRef } from "vue";
	import { injectValidatedFormRequired } from "./validated-form.vue";
	import { useValidation, type Validator } from "./validation-utils";

	const props = withDefaults(defineProps<{
		/** The value that will be passed to the validators. */
		value: T;
		validators?: Array<Validator<T>>;
		/** If true, showStatus will be true even if there is no validation error. */
		reportValid?: boolean;
		/** If true, showStatus will be true even if the field is not touched yet. */
		immediate?: boolean;
		debounceMs?: number;
	}>(), {
		validators: () => []
	});

	const validatedForm = injectValidatedFormRequired();
	const validation = useValidation(reactive({
		validatedForm,
		value: toRef(() => props.value),
		validators: toRef(() => props.validators),
		immediate: toRef(() => props.immediate),
		debounceMs: toRef(() => props.debounceMs),
	}));

	defineExpose(readonly(validation));

	defineSlots<{
		default(props: typeof validation): any;
	}>();
</script>

<template>
	<slot v-bind="validation"></slot>
</template>