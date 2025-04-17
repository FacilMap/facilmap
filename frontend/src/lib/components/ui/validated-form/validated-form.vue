<script lang="ts">
	import { type Ref, onScopeDispose, reactive, readonly, ref, watchEffect, toRef, computed } from "vue";
	import { type ExtendableEventMixin, extendableEventMixin, useDomEventListener } from "../../../utils/utils";
	import { useToasts } from "../toasts/toasts.vue";

	export interface ValidatedFormData {
		isTouched: boolean;
		isSubmitting: boolean;
		isValidating: boolean;
		formValidationError: string | undefined;
		submit: () => Promise<void>;
		setValidationPromise: (element: Element, promise: Promise<any> | undefined) => void;
	}

	export interface CustomSubmitEvent extends ExtendableEventMixin {
		preventDefault(): void;
	}

	const allForms = reactive(new Map<Ref<HTMLFormElement | undefined>, ValidatedFormData>());

	export function useValidatedForm(
		formRef: Ref<HTMLFormElement | undefined>,
		onSubmit: (event: CustomSubmitEvent) => void,
		{ noValidate, formValidationError }: {
			noValidate?: Ref<boolean>;
			/** A form validation error that will prevent the form from submitting. */
			formValidationError?: Ref<string | undefined>;
		} = {}
	): Readonly<ValidatedFormData> {
		const toasts = useToasts();
		const validationPromises = new Map<Element, Promise<any>>();
		const isValidating = reactive(new Map<Element, boolean>());

		const data: ValidatedFormData = reactive<Omit<ValidatedFormData, "formValidationError"> & { formValidationError: Ref<string | undefined> }>({
			isTouched: false,
			isSubmitting: false,
			isValidating: false,
			formValidationError: toRef(formValidationError),
			submit: toasts.toastErrors(async () => {
				data.isTouched = true;
				data.isSubmitting = true;

				try {
					if (!noValidate?.value) {
						await Promise.all(validationPromises.values());

						if (!formRef.value!.checkValidity() || formValidationError?.value) {
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
			setValidationPromise: (element, promise) => {
				if (promise) {
					if (validationPromises.get(element) !== promise) {
						validationPromises.set(element, promise);
						isValidating.set(element, true);
						void promise.finally(() => {
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

		useDomEventListener(formRef, "submit", (e) => {
			e.preventDefault();
			void data.submit();
		});

		useDomEventListener(formRef, "keydown", (e) => {
			// Allow pressing Ctrl+Enter to submit from within text areas, select boxes etc.
			if ((e.ctrlKey || e.metaKey) && e.code === "Enter") {
				e.preventDefault();
				void data.submit();
			}
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
		formValidationError?: string | undefined;
		id?: string;
		method?: string;
	}>();

	const emit = defineEmits<{
		submit: [event: CustomSubmitEvent];
	}>();

	const formRef = ref<HTMLFormElement>();
	const formData = useValidatedForm(formRef, (event) => {
		emit("submit", event);
	}, {
		noValidate: toRef(() => props.noValidate),
		formValidationError: toRef(() => props.formValidationError)
	});

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
</script>

<template>
	<form
		novalidate
		ref="formRef"
		:action="actionWithoutQuery ?? 'javascript:'"
		:target="props.target"
		:class="{ 'fm-was-validated': formData.isTouched }"
		:id="props.id"
		:method="props.method"
	>
		<template v-for="[key, value] in actionParams?.entries()" :key="key">
			<input type="hidden" :name="key" :value="value" />
		</template>

		<slot :formData="formData"/>
	</form>
</template>