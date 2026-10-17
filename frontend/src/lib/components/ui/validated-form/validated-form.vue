<script lang="ts">
	import { type Ref, onScopeDispose, reactive, ref, watchEffect, toRef, computed, type InjectionKey, inject, provide, shallowReadonly } from "vue";
	import { type ExtendableEventMixin, extendableEventMixin, useDomEventListener } from "../../../utils/utils";
	import { useToasts } from "../toasts/toasts.vue";
	import { isPromise } from "facilmap-utils";
	import type { WrapNestedRefs } from "../../../utils/vue";

	export interface ValidatedFormData {
		formRef: HTMLFormElement | undefined;
		/** True if the form has been attempted to be submitted at least once. */
		isTouched: boolean;
		/** True if the form submission is currently in progress and the validation results are being awaited. */
		isSubmitting: boolean;
		/** True if some async validators are running right now. This can also happen outside of a form submission. */
		isValidating: boolean;
		/**
		 * Submits the form. Will await all running async validations and then call onSubmit() if there are no
		 * validation errors. If there are validation errors, nothing is done.
		 */
		submit: () => Promise<void>;
		setValidationResult: (key: any, result: Promise<string | undefined> | string | undefined) => void;
	}

	export interface CustomSubmitEvent extends ExtendableEventMixin {
		preventDefault(): void;
	}

	const allForms = reactive(new Map<Ref<HTMLFormElement | undefined>, ValidatedFormData>());

	const contextKey = Symbol.for("fm-validated-form") as InjectionKey<ValidatedFormData>;

	export function injectValidatedForm(): ValidatedFormData | undefined {
		return inject(contextKey);
	}

	export function injectValidatedFormRequired(): ValidatedFormData {
		const formData = injectValidatedForm();
		if (!formData) {
			throw new Error("Component must be nested in a <ValidatedForm>.");
		}
		return formData;
	}

	export function useValidatedForm(
		formRef: Ref<HTMLFormElement | undefined>,
		onSubmit: (event: CustomSubmitEvent) => void,
		options: {
			noValidate?: boolean;
		} = {}
	): Readonly<ValidatedFormData> {
		const toasts = useToasts();
		const validationResults = new Map<any, Promise<string | undefined> | string | undefined>()
		const isValidating = reactive(new Map<Element, boolean>());

		const data: ValidatedFormData = reactive<WrapNestedRefs<ValidatedFormData>>({
			formRef,
			isTouched: false,
			isSubmitting: false,
			isValidating: false,
			submit: toasts.toastErrors(async () => {
				data.isTouched = true;
				data.isSubmitting = true;

				try {
					if (!options.noValidate) {
						const results = await Promise.all(validationResults.values());

						if (!formRef.value!.checkValidity() || results.some((v) => v)) {
							return;
						}
					}

					let prevented = false;
					const event = {
						...extendableEventMixin,
						preventDefault() {
							prevented = true;
						}
					};
					onSubmit(event);
					await event._awaitPromises();

					if (!prevented) {
						formRef.value?.submit();
					}
				} finally {
					data.isSubmitting = false;
				}
			}),
			setValidationResult: (key, result) => {
				if (result) {
					if (isPromise(result) && validationResults.get(key) !== result) {
						isValidating.set(key, true);
						void result.finally(() => {
							if (validationResults.get(key) === result) {
								isValidating.set(key, false);
							}
						});
					}

					validationResults.set(key, result);
				} else {
					validationResults.delete(key);
					isValidating.delete(key);
				}
			}
		});

		watchEffect(() => {
			data.isValidating = [...isValidating.values()].some((v) => v);
		});

		useDomEventListener(formRef, "submit", (e) => {
			e.preventDefault();
			void data.submit();
		});

		allForms.set(formRef, data);

		onScopeDispose(() => {
			allForms.delete(formRef);
		});

		return shallowReadonly(data);
	}

	export function getValidatedForm(form: HTMLFormElement): Readonly<ValidatedFormData> | undefined {
		for (const [formRef, formData] of allForms) {
			if (formRef.value === form) {
				return formData;
			}
		}
	}

	/**
	 * A form that handles the validation of its fields.
	 *
	 * An interface is exposed. If can be accessed through the `formData` property on a ref to the ValidatedForm
	 * component, through the `formData` slot prop of the default slot, by using injectValidatedForm() or
	 * injectValidatedFormRequired() in child components, or by calling getValidatedForm(formElement) (in
	 * particular getValidatedForm(inputElement.form)).
	 *
	 * Components can update their validation status by calling `setValidationResult(key, result)`. `key`
	 * is a unique key identifying the component and can be of any type. `result` is an empty string or
	 * undefined if there is no validation error, or a non-empty string if there is a validation error.
	 * Components are responsible for calling `setValidationResult(key, undefined)` when they are unmounted.
	 * Aynchronous validation is possible by setting a promise as the validation result.
	 * The validation result is only used by the form to determine whether there are any errors. Form fields
	 * are responsible for displaying the validation status and messages.
	 *
	 * When the form is submitted through a submit button or through the exposed submit() function, firstly
	 * any asynchronous validation results are awaited. After, if there is at least one validation error, or
	 * if form.checkValidity() returns false, nothing is done. Otherwise, the form is submitted.
	 *
	 * Two implementations of form fields are available:
	 * - <ValidatedField> can be used for real input fields. It will validate the fields as soon as their
	 *   values are changed or they lose focus, and their validity is set using input.setCustomValidity() to
	 *   allow for proper Bootstrap styling.
	 * - <Validation> is more abstract and simply validates a computed value. This is useful for validating
	 *   parts of the form that consist of multiple values.
	 */
	export default {};
</script>

<script setup lang="ts">
	const props = defineProps<{
		action?: string;
		target?: string;
		noValidate?: boolean;
	}>();

	const emit = defineEmits<{
		submit: [event: CustomSubmitEvent];
	}>();

	const formRef = ref<HTMLFormElement>();
	const formData = useValidatedForm(formRef, (event) => {
		emit("submit", event);
	}, reactive({
		noValidate: toRef(() => props.noValidate)
	}));

	const actionWithoutQuery = computed(() => {
		if (props.action != null) {
			const url = new URL(props.action);
			url.search = "";
			return url.toString();
		}
	});
	const actionParams = computed(() => {
		if (props.action != null) {
			const url = new URL(props.action);
			return url.searchParams;
		}
	});

	defineExpose({ formData });
	provide(contextKey, formData);
</script>

<template>
	<form
		novalidate
		ref="formRef"
		:action="actionWithoutQuery ?? 'javascript:'"
		:target="props.target"
		:class="{ 'fm-was-validated': formData.isTouched }"
	>
		<template v-for="[key, value] in actionParams?.entries()" :key="key">
			<input type="hidden" :name="key" :value="value" />
		</template>

		<slot :formData="formData"/>
	</form>
</template>