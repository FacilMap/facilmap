<script setup lang="ts" generic="T">
	import { ref, watchEffect, computed, readonly, type ComponentPublicInstance, reactive, toRef } from "vue";
	import { useDomEventListener } from "../../../utils/utils";
	import { getValidatedForm } from "./validated-form.vue";
	import { useValidation, type Validator } from "./validation-utils";

	const props = withDefaults(defineProps<{
		/** The value that will be passed to the validators. */
		value: T;
		validators?: Array<Validator<T>>;
		tag?: string;
		/** If true, show the validation status also if the value is valid. */
		reportValid?: boolean;
		/** If true, validate the field immediately without waiting for a change/blur/submit. */
		immediate?: boolean;
		debounceMs?: number;
	}>(), {
		tag: "div",
		validators: () => []
	});

	type FormElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

	const inputRef = ref<FormElement>();
	const formRef = ref<HTMLFormElement>();

	watchEffect((onCleanup) => {
		if (inputRef.value) {
			formRef.value = inputRef.value.form ?? undefined;

			const obs = new MutationObserver(() => {
				formRef.value = inputRef.value?.form ?? undefined;
			});
			obs.observe(inputRef.value, { attributes: true });
			onCleanup(() => {
				obs.disconnect();
			});
		} else {
			formRef.value = undefined;
		}
	});
	const validatedForm = computed(() => formRef.value && getValidatedForm(formRef.value));

	const validation = useValidation(reactive({
		validatedForm,
		validators: toRef(() => props.validators),
		value: toRef(() => props.value),
		reportValid: toRef(() => props.reportValid),
		immediate: toRef(() => props.immediate),
		debounceMs: toRef(() => props.debounceMs)
	}));

	watchEffect(() => {
		if (inputRef.value) {
			inputRef.value.setCustomValidity(validation.validationError ?? "");
		}
	});

	function handleTouched() {
		console.log("touch");
		validation.touch();
	}

	useDomEventListener(inputRef, "input", handleTouched);
	useDomEventListener(inputRef, "blur", handleTouched);
	useDomEventListener(inputRef, "focusout", handleTouched);

	function setInputRef(el: any | null): void {
		inputRef.value = el as FormElement ?? undefined;
	}

	defineExpose(readonly(validation));

	defineSlots<{
		default(props: typeof validation & {
			/**
			 * A reference to the input element that needs to be set by consumers of this component. This must be set,
			 * otherwise validation will not work. To add a validation without an input element, use <Validation> instead.
			 * Validation will be triggered when it the input field is edited, or when focus leaves it, or when its form
			 * is submitted. The corresponding form will be determined based on its `form` attribute (if set). The
			 * custom validity of the input field will be set to the validation result.
			 */
			inputRef: (ref: Element | ComponentPublicInstance | null) => void;
		}): any;
	}>();

	watchEffect(() => {
		console.log(validation.showStatus);
	});
</script>

<template>
	<component
		:is="props.tag"
		:class="{
			'was-validated': validation.showStatus
		}"
	>
		<slot
			v-bind="validation"
			:inputRef="setInputRef"
		></slot>
	</component>
</template>