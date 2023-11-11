<script lang="ts">
	import { computed, createApp, defineComponent, h, ref, type VNode, type VNodeArrayChildren, withDirectives } from "vue";
	import Alert from "./alert.vue";
	import vValidity from "./validated-form/validity";
	import type { ThemeColour } from "../../utils/bootstrap";
	import ModalDialog from "./modal-dialog.vue";

	export type AlertProps = {
		title: string;
		message: string;
		type?: "alert" | "confirm";
		variant?: ThemeColour;
		show?: boolean;
		okLabel?: string;
		okFocus?: boolean;
	};

	export interface AlertResult {
		ok: boolean;
	}

	async function renderAlert({ getContent, onShown, ...props }: AlertProps & {
		getContent?: () => string | VNode | VNodeArrayChildren;
		onShown?: () => void;
	}): Promise<AlertResult> {
		return await new Promise<AlertResult>((resolve) => {
			const el = document.createElement('div');
			document.body.appendChild(el);
			const app = createApp(defineComponent({
				setup() {
					return () => h(Alert, {
						...props,
						onShown: () => {
							onShown?.();
						},
						onHide: (result) => {
							resolve(result);
						},
						onHidden: () => {
							app.unmount();
							el.remove();
						}
					}, getContent);
				}
			}));
			app.mount(el);
		});
	}

	export async function showAlert(props: Omit<AlertProps, 'type' | 'show' | 'okFocus'>): Promise<void> {
		await renderAlert({ ...props, okFocus: true, type: 'alert' });
	}

	export async function showConfirm(props: Omit<AlertProps, 'type' | 'show' | 'okFocus'>): Promise<boolean> {
		const result = await renderAlert({ ...props, okFocus: true, type: 'confirm' });
		return result.ok;
	}

	export async function showPrompt({ initialValue = "", validate, ...props }: Omit<AlertProps, 'type' | 'show' | 'message' | 'okFocus'> & {
		initialValue?: string;
		/** Validate the value. Return an empty string or undefined to indicate validity. */
		validate?: (value: string) => string | undefined;
	}): Promise<string | undefined> {
		const value = ref(initialValue);
		const submitted = ref(false);
		const validationError = computed(() => submitted.value ? undefined : validate?.(value.value));
		const touched = ref(false);
		const inputRef = ref<HTMLInputElement>();

		const result = await renderAlert({
			...props,
			message: '',
			okFocus: false,
			type: 'confirm',
			getContent: () => h('div', {
				class: touched.value ? 'was-validated' : ''
			}, [
				withDirectives(
					h('input', {
						type: "text",
						class: "form-control",
						value: value.value,
						onInput: (e: InputEvent) => {
							value.value = (e.target as HTMLInputElement).value;
							touched.value = true;
						},
						onBlur: () => {
							touched.value = true;
						},
						autofocus: true,
						ref: inputRef
					}), [
						[vValidity, validationError.value]
					]
				),
				h('div', {
					class: "invalid-feedback"
				}, validationError.value)
			]),
			onShown: () => {
				inputRef.value!.focus();
			}
		});

		submitted.value = true;

		return result.ok ? value.value : undefined;
	}
</script>

<script setup lang="ts">
	const props = withDefaults(defineProps<AlertProps>(), {
		type: "alert",
		okLabel: "OK",
		okFocus: true
	});

	const emit = defineEmits<{
		shown: [];
		hide: [result: AlertResult];
		hidden: [result: AlertResult];
	}>();

	const result = ref<AlertResult>({
		ok: false
	});

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const handleSubmit = () => {
		result.value.ok = true;
		modalRef.value!.modal.hide();
	};
</script>

<template>
	<ModalDialog
		:title="props.title"
		:isCreate="props.type === 'confirm'"
		:okLabel="props.okLabel"
		:okVariant="props.variant"
		:okFocus="props.okFocus"
		@shown="emit('shown')"
		@hide="emit('hide', result)"
		@hidden="emit('hidden', result)"
		@submit="handleSubmit"
		ref="modalRef"
	>
		<slot>{{props.message}}</slot>
	</ModalDialog>
</template>