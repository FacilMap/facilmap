import { extend, withValidation } from "vee-validate";

extend("required", {
	validate: (val: any) => !!val,
	message: "Must not be empty.",
	computesRequired: true
});

extend("padId", {
	validate: (id: string) => !id.includes("/"),
	message: "May not contain a slash."
});

export type ValidationContext = Parameters<Exclude<Parameters<typeof withValidation>[1], undefined>>[0];

export function getValidationState(v: ValidationContext): boolean | null {
	return v.dirty || v.validated ? v.valid : null;
}