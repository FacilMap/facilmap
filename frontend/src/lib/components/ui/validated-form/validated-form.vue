<script lang="ts">
	import { type Ref, onScopeDispose, reactive, readonly, ref, watchEffect, toRef } from "vue";
	import { type ExtendableEventMixin, extendableEventMixin } from "../../../utils/utils";
	import { useToasts } from "../toasts/toasts.vue";

	export interface ValidatedFormData {
		isTouched: boolean;
		isSubmitting: boolean;
		isValidating: boolean;
		submit: () => Promise<void>;
		setValidationPromise: (element: Element, promise: Promise<any> | undefined) => void;
	}

	export interface CustomSubmitEvent extends ExtendableEventMixin {
	}

	const allForms = reactive(new Map<Ref<HTMLFormElement | undefined>, ValidatedFormData>());

	export function useValidatedForm(
		formRef: Ref<HTMLFormElement | undefined>,
		onSubmit: (event: CustomSubmitEvent) => void,
		{ noValidate }: { noValidate?: Ref<boolean> } = {}
	): Readonly<ValidatedFormData> {
		const toasts = useToasts();
		const validationPromises = new Map<Element, Promise<any>>();
		const isValidating = reactive(new Map<Element, boolean>());

		const data: ValidatedFormData = reactive({
			isTouched: false,
			isSubmitting: false,
			isValidating: false,
			submit: toasts.toastErrors(async () => {
				data.isTouched = true;
				data.isSubmitting = true;

				try {
					if (!noValidate?.value) {
						await Promise.all(validationPromises.values());

						if (!formRef.value!.checkValidity()) {
							return;
						}
					}

					const event = { ...extendableEventMixin };
					onSubmit(event);
					await event._awaitPromises();
				} finally {
					data.isSubmitting = false;
				}
			}),
			setValidationPromise: (element, promise) => {
				if (promise) {
					if (validationPromises.get(element) !== promise) {
						validationPromises.set(element, promise);
						isValidating.set(element, true);
						promise.finally(() => {
							if (validationPromises.get(element) === promise) {
								isValidating.set(element, false);
							}
						});
					}
				} else {
					validationPromises.delete(element);
					isValidating.delete(element);
				}
			}
		});

		watchEffect(() => {
			data.isValidating = [...isValidating.values()].some((v) => v);
		});

		allForms.set(formRef, data);

		onScopeDispose(() => {
			allForms.delete(formRef);
		});

		return readonly(data);
	}

	export function getValidatedForm(form: HTMLFormElement): Readonly<ValidatedFormData> | undefined {
		for (const [formRef, formData] of allForms) {
			if (formRef.value === form) {
				return formData;
			}
		}
	}
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
	}, {
		noValidate: toRef(() => props.noValidate)
	});

	defineExpose({ formData });
</script>

<template>
	<form
		@submit.prevent="formData.submit()"
		novalidate
		ref="formRef"
		:action="props.action"
		:target="props.target ?? 'javascript:'"
		:class="{ 'fm-was-validated': formData.isTouched }"
	>
		<slot :formData="formData"/>
	</form>
</template>