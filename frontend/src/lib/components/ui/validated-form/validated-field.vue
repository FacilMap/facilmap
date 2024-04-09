<script lang="ts">
	import { ref, watchEffect, computed, watchSyncEffect } from "vue";
	import { isPromise } from "facilmap-utils";
	import { useDomEventListener } from "../../../utils/utils";
	import { getValidatedForm } from "./validated-form.vue";
	import { useToasts } from "../toasts/toasts.vue";
	import pDebounce from "p-debounce";
	import { useI18n } from "../../../utils/i18n";

	type SyncValidationResult = string | undefined;
	type AsyncValidationResult = Promise<SyncValidationResult>;
	type ValidationResult = SyncValidationResult | AsyncValidationResult;
	export type Validator<T> = (value: T, signal: AbortSignal) => ValidationResult;

	function validate<T>(value: T, validators: Array<Validator<T>>, signal: AbortSignal): ValidationResult {
		for (let i = 0; i < validators.length; i++) {
			if (signal.aborted) {
				return;
			}

			const result = validators[i](value, signal);
			if (isPromise(result)) {
				return resolveValidationResult([
					result,
					...validators.slice(i + 1).map((validator) => validator(value, signal))
				], signal);
			} else if (result) {
				return result;
			}
		}
		return undefined;
	}

	function resolveValidationResult(results: ValidationResult[], signal: AbortSignal): AsyncValidationResult {
		return new Promise<SyncValidationResult>((resolve, reject) => {
			for (const result of results) {
				void Promise.resolve(result).then((res) => {
					if (res) {
						resolve(res);
					}
				});
			}

			Promise.all(results).then(() => {
				resolve(undefined);
			}).catch(reject);
		});
	}
</script>

<script setup lang="ts" generic="T">
	const toasts = useToasts();
	const i18n = useI18n();

	const props = withDefaults(defineProps<{
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

	const validationErrorPromise = ref<Promise<void>>();
	const resolvedValidationError = ref<string | undefined>();
	const isValidating = ref(false);

	let debouncedValidate: typeof validate;
	watchSyncEffect(() => {
		debouncedValidate = pDebounce(validate, props.debounceMs ?? 0);
	});

	// Memoize validators prop with a shallow equality check, since mostly we specify them using an inline array
	const memoizedValidators = ref<Array<Validator<T>>>([]);
	watchEffect(() => {
		if (props.validators.length !== memoizedValidators.value.length || props.validators.some((v, i) => memoizedValidators.value[i] !== v)) {
			memoizedValidators.value = props.validators;
		}
	});

	watchEffect((onCleanup) => {
		const abortController = new AbortController();
		onCleanup(() => {
			abortController.abort();
		});

		try {
			toasts.hideToast("fm-validity-error");

			const result = (props.debounceMs ? debouncedValidate : validate)(props.value, memoizedValidators.value, abortController.signal);
			if (isPromise(result)) {
				isValidating.value = true;
				const promise = validationErrorPromise.value = result.then((res) => {
					if (validationErrorPromise.value === promise) {
						resolvedValidationError.value = res;
						isValidating.value = false;
					}
				}).catch((err) => {
					if (validationErrorPromise.value === promise) {
						toasts.showErrorToast("fm-validity-error", i18n.t("validated-field.validation-error"), err);
						resolvedValidationError.value = i18n.t("validated-field.validation-error");
						isValidating.value = false;
					}
				});
			} else {
				validationErrorPromise.value = undefined;
				resolvedValidationError.value = result;
				isValidating.value = false;
			}
		} catch (err: any) {
			toasts.showErrorToast("fm-validity-error", i18n.t("validated-field.validation-error"), err);
			validationErrorPromise.value = undefined;
			resolvedValidationError.value = i18n.t("validated-field.validation-error");
			isValidating.value = false;
		}
	});

	watchEffect(() => {
		if (inputRef.value) {
			inputRef.value.setCustomValidity(resolvedValidationError.value ?? "");
		}
	});

	watchEffect(() => {
		if (validatedForm.value && inputRef.value) {
			validatedForm.value.setValidationPromise(inputRef.value, validationErrorPromise.value);
		}
	});

	const touched = ref(false);

	function handleTouched() {
		setTimeout(() => { // Give validators a chance to run on the updated value first
			touched.value = true;
		}, 0);
	}

	useDomEventListener(inputRef, "input", handleTouched);
	useDomEventListener(inputRef, "blur", handleTouched);
	useDomEventListener(inputRef, "focusout", handleTouched);
	useDomEventListener(formRef, "submit", handleTouched);

	const wasValidated = computed(() => !isValidating.value && (props.immediate || touched.value) && (props.reportValid || !!resolvedValidationError.value));

	function setInputRef(el: any | null): void {
		inputRef.value = el as FormElement ?? undefined;
	}
</script>

<template>
	<component
		:is="props.tag"
		:class="{
			'was-validated': wasValidated
		}"
	>
		<slot
			:isValidating="isValidating"
			:validationError="resolvedValidationError"
			:inputRef="setInputRef"
		></slot>
	</component>
</template>