import type { Directive } from "vue";
import { isPromise } from "../../../utils/utils";
import { getValidatedForm } from "./validated-form.vue";
import { type ToastContext, useToasts } from "../toasts/toasts.vue";

declare global {
	interface Element {
		_fmValidityPromise?: Promise<string | undefined>;
		_fmValidityToasts?: ToastContext;

		_fmValidityInputListener?: () => void;
		_fmValidityTouched?: boolean;
	}
}

type FormElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type Value = string | undefined | Promise<string | undefined>;

const updateValidity: Directive<FormElement, Value> = (el, binding) => {
	if (!el._fmValidityToasts) {
		el._fmValidityToasts = useToasts(true);
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


const updateValidityContext: Directive<FormElement, void> = (el, binding) => {
	if (!el._fmValidityInputListener) {
		el._fmValidityInputListener = () => {
			el._fmValidityTouched = true;
			el.classList.add("was-validated");
		};
		el.addEventListener("input", el._fmValidityInputListener);
		el.addEventListener("blur", el._fmValidityInputListener);
		el.addEventListener("focusout", el._fmValidityInputListener);
	}

	el.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select")?.form?.addEventListener("submit", el._fmValidityInputListener);

	if (el._fmValidityTouched) {
		el.classList.add("was-validated");
	}
};

export const vValidityContext: Directive<FormElement, void> = {
	mounted: updateValidityContext,
	beforeUpdate: (el) => {
		if (el._fmValidityInputListener) {
			el.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select")?.removeEventListener("submit", el._fmValidityInputListener); // Added again during updated
		}
	},
	updated: updateValidityContext,
	beforeUnmount: (el) => {
		if (el._fmValidityInputListener) {
			el.removeEventListener("input", el._fmValidityInputListener);
			el.removeEventListener("blur", el._fmValidityInputListener);
			el.removeEventListener("focusout", el._fmValidityInputListener);
			el.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select")?.removeEventListener("submit", el._fmValidityInputListener);
			delete el._fmValidityInputListener;
		}
	}
};
