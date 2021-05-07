import { extend, withValidation } from "vee-validate";
import Vue from "vue";

extend("required", {
	validate: (val: any) => !!val,
	message: "Must not be empty.",
	computesRequired: true
});

export type ValidationContext = Parameters<Exclude<Parameters<typeof withValidation>[1], undefined>>[0];

export function getValidationState(v: ValidationContext, showValid = false): boolean | null {
	if (v.dirty || v.validated)
		return !v.valid || showValid ? v.valid : null;
	else
		return null;
}

Vue.filter('validationState', getValidationState);