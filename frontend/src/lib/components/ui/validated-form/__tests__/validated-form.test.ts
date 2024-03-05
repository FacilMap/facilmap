import { describe, expect, test, vi } from "vitest";
import { createApp, h, ref } from "vue";
import ValidatedForm, { getValidatedForm, type CustomSubmitEvent, type ValidatedFormData } from "../validated-form.vue";
import { isPromise, sleep } from "facilmap-utils";

function mockForm({ onSubmit, validationError }: {
	onSubmit?: (event: CustomSubmitEvent) => void;
	validationError?: string | undefined | Promise<string | undefined>;
}): {
	formData: Readonly<ValidatedFormData>;
} {
	const formRef = ref<InstanceType<typeof ValidatedForm>>();
	const inputRef = ref<HTMLInputElement>();
	const app = createApp({
		setup() {
			return () => h(ValidatedForm, {
				onSubmit,
				ref: formRef
			}, () => [
				h('input', {
					ref: inputRef
				})
			]);
		}
	});
	const div = document.createElement('div');
	document.body.appendChild(div);
	app.mount(div);

	if (isPromise(validationError)) {
		getValidatedForm(inputRef.value!.form!)!.setValidationPromise(inputRef.value!, validationError.then((res) => {
			inputRef.value!.setCustomValidity(res || "");
		}));
	} else if (validationError) {
		inputRef.value!.setCustomValidity(validationError);
	}

	return {
		formData: formRef.value!.formData
	};
}

test("<ValidatedForm> waits for onSubmit promise", async () => {
	let resolvePromise: () => void;
	const onSubmit = vi.fn((event: CustomSubmitEvent) => {
		event.waitUntil(new Promise<void>((resolve) => {
			resolvePromise = resolve;
		}));
	});

	const { formData } = mockForm({ onSubmit });
	await sleep(0);

	const form = document.querySelector('form')!;

	expect(formData.isSubmitting).toBe(false);
	expect(formData.isTouched).toBe(false);

	form.dispatchEvent(new Event('submit', { bubbles: true }))

	expect(formData.isSubmitting).toBe(true);
	expect(formData.isTouched).toBe(true);
	await sleep(0);
	expect(formData.isSubmitting).toBe(true);

	resolvePromise!();
	await sleep(0);
	expect(formData.isSubmitting).toBe(false);
});

describe("<ValidatedForm> handles validation errors", () => {
	test("submits when there are no validation errors (sync)", async () => {
		const onSubmit = vi.fn();
		const { formData } = mockForm({
			onSubmit,
			validationError: undefined
		});
		await sleep(0);

		expect(onSubmit).toBeCalledTimes(0);
		await formData!.submit();
		expect(onSubmit).toBeCalledTimes(1);
	});

	test("submits when there are no validation errors (async)", async () => {
		const onSubmit = vi.fn();
		const { formData } = mockForm({
			onSubmit,
			validationError: Promise.resolve(undefined)
		});
		await sleep(0);

		expect(onSubmit).toBeCalledTimes(0);
		await formData!.submit();
		expect(onSubmit).toBeCalledTimes(1);
	});

	test("does not submit when there are validation errors (sync)", async () => {
		const onSubmit = vi.fn();
		const { formData } = mockForm({
			onSubmit,
			validationError: "Error"
		});
		await sleep(0);

		expect(onSubmit).toBeCalledTimes(0);
		await formData!.submit();
		expect(onSubmit).toBeCalledTimes(0);
	});

	test("does not submit when there are validation errors (async)", async () => {
		const onSubmit = vi.fn();
		const { formData } = mockForm({
			onSubmit,
			validationError: Promise.resolve("Error")
		});
		await sleep(0);

		expect(onSubmit).toBeCalledTimes(0);
		await formData!.submit();
		expect(onSubmit).toBeCalledTimes(0);
	});
});