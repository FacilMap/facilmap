import { extend, withValidation } from "vee-validate";
import Vue from "vue";

extend("required", {
	validate: (val: any) => !!val,
	message: "Must not be empty.",
	computesRequired: true
});

export type ValidationContext = Parameters<Exclude<Parameters<typeof withValidation>[1], undefined>>[0];

export function getValidationState(v: ValidationContext): boolean | null {
	return (v.dirty || v.validated) && !v.valid ? false : null;
}

Vue.filter('validationState', getValidationState);