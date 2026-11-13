import { ref, watchEffect, computed, watchSyncEffect, reactive, toRef } from "vue";
import { isPromise } from "facilmap-utils";
import { getUniqueId, useDomEventListener } from "../../../utils/utils";
import { type ValidatedFormData } from "./validated-form.vue";
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

export function useValidation<T>(data: {
	validatedForm: Readonly<ValidatedFormData> | undefined;
	/** The value that will be passed to the validators. */
	value: T;
	validators: Array<Validator<T>>;
	/** If true, showStatus will be true even if there is no validation error. */
	reportValid?: boolean;
	/** If true, showStatus will be true even if the field is not touched yet. */
	immediate?: boolean;
	debounceMs?: number;
}): {
	isValidating: boolean;
	validationError: SyncValidationResult;
	isTouched: boolean;
	/** If true, the validation status and message should be rendered by the UI, usually by setting the `was-validated` class. */
	showStatus: boolean;
	touch: () => void;
} {
	const toasts = useToasts();
	const i18n = useI18n();

	const id = getUniqueId("fm-validation-utils");

	/**
	 * The sync or async validation result that will be reported to the form. Once the promise is resolved, it is replaced with
	 * the sync result.
	 */
	const validationResult = ref<ValidationResult>();
	/**
	 * A copy of the last available sync result. This is returned as `validationError` and can be displayed to the user while
	 * a new validation result is computing.
	 */
	const lastSyncResult = ref<SyncValidationResult>();
	const isValidating = computed(() => isPromise(validationResult.value));

	let debouncedValidate: typeof validate;
	watchSyncEffect(() => {
		debouncedValidate = pDebounce(validate, data.debounceMs ?? 0);
	});

	// Memoize validators prop with a shallow equality check, since mostly we specify them using an inline array
	const memoizedValidators = ref<Array<Validator<T>>>([]);
	watchEffect(() => {
		if (data.validators.length !== memoizedValidators.value.length || data.validators.some((v, i) => memoizedValidators.value[i] !== v)) {
			memoizedValidators.value = data.validators;
		}
	});

	watchEffect((onCleanup) => {
		const abortController = new AbortController();
		onCleanup(() => {
			abortController.abort();
		});

		try {
			toasts.hideToast("fm-validity-error");

			const result = (data.debounceMs ? debouncedValidate : validate)(data.value, memoizedValidators.value, abortController.signal);
			if (isPromise(result)) {
				const promise = validationResult.value = result.then((res) => {
					if (validationResult.value === promise) {
						return validationResult.value = lastSyncResult.value = res;
					}
				}).catch((err) => {
					if (validationResult.value === promise) {
						toasts.showErrorToast("fm-validity-error", () => i18n.t("validated-field.validation-error"), err);
						return validationResult.value = lastSyncResult.value = i18n.t("validated-field.validation-error");
					}
				});
			} else {
				validationResult.value = lastSyncResult.value = result;
			}
		} catch (err: any) {
			toasts.showErrorToast("fm-validity-error", () => i18n.t("validated-field.validation-error"), err);
			validationResult.value = lastSyncResult.value = i18n.t("validated-field.validation-error");
		}
	});

	watchEffect(() => {
		if (data.validatedForm) {
			data.validatedForm.setValidationResult(id, validationResult.value);
		}
	});

	const isTouched = ref(false);
	const touch = () => {
		setTimeout(() => { // Give validators a chance to run on the updated value first
			isTouched.value = true;
		}, 0);
	};

	useDomEventListener(toRef(() => data.validatedForm?.formRef), "submit", touch);

	watchEffect(() => {
		console.log(isValidating.value, data.immediate, isTouched.value, data.reportValid, lastSyncResult.value);
	});
	const showStatus = computed(() => !isValidating.value && (data.immediate || isTouched.value) && (data.reportValid || !!lastSyncResult.value));

	return reactive({
		isValidating,
		validationError: lastSyncResult,
		isTouched,
		showStatus,
		touch
	});
}