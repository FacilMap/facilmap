import { Directive } from "vue";
import { isPromise } from "../../../utils/utils";
import { getValidatedForm } from "./validated-form.vue";
import { ToastContext, useToasts } from "../toasts/toasts.vue";

declare global {
	interface Element {
		_fmValidityPromise?: Promise<string | undefined>;
		_fmValidityToasts?: ToastContext;
	}
}

type FormElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type Value = string | undefined | Promise<string | undefined>;

const updateValidity: Directive<FormElement, Value> = (el, binding) => {
	if (!el._fmValidityToasts) {
		el._fmValidityToasts = useToasts();
	}

	const formData = el.form && getValidatedForm(el.form);
	if (isPromise(binding.value)) {
		const promise = binding.value;
		el._fmValidityPromise = promise;
		promise.then((value) => {
			if (el._fmValidityPromise === promise) {
				el._fmValidityToasts?.hideToast("fm-validity-error");
				el.setCustomValidity(value ?? "");
			}
		}).catch((err) => {
			if (el._fmValidityPromise === promise) {
				el._fmValidityToasts?.showErrorToast("fm-validity-error", "Error while validating form field", err);
				el.setCustomValidity("Error while validating form field");
			}
		});
		formData?.setValidationPromise(el, promise);
	} else {
		el.setCustomValidity(binding.value ?? "");
		delete el._fmValidityPromise;
		formData?.setValidationPromise(el, undefined);
	}
}

const vValidity: Directive<FormElement, Value> = {
	mounted: updateValidity,
	updated: updateValidity,
	beforeUnmount: (el) => {
		delete el._fmValidityPromise;
		const formData = el.form && getValidatedForm(el.form);
		formData?.setValidationPromise(el, undefined);

		if (el._fmValidityToasts) {
			el._fmValidityToasts.dispose();
			delete el._fmValidityToasts;
		}
	}
};

export default vValidity;
