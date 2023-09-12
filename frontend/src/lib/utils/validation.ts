import { extend } from "vee-validate";
import Vue from "vue";
import { ValidationContext as OriginalValidationContext } from "vee-validate/dist/types/components/common";
import { ValidationFlags } from "vee-validate/dist/types/types";

extend("required", {
	validate: (val: any) => !!val,
	message: "Must not be empty.",
	computesRequired: true
});

// ValidationContext extends Pick<ValidationFlags, KnownKeys<ValidationFlags>>, but the KnownKeys type is broken.
// This is a replacement from https://github.com/slackapi/bolt-js/issues/951#issuecomment-857308100
type OmitIndexSignature<T> = {
	[K in keyof T as string extends K ? never : number extends K ? never : K]: T[K];
};

export type ValidationContext = OriginalValidationContext & OmitIndexSignature<ValidationFlags>;

export function getValidationState(v: ValidationContext, showValid = false): boolean | null {
	if (v.dirty || v.validated)
		return !v.valid || showValid ? v.valid : null;
	else
		return null;
}

Vue.filter('validationState', getValidationState);