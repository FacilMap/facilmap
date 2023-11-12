<script lang="ts">
	import { createApp, defineComponent, h, ref, type VNode, type VNodeArrayChildren } from "vue";
	import Alert from "./alert.vue";
	import type { ThemeColour } from "../../utils/bootstrap";
	import ModalDialog from "./modal-dialog.vue";
	import ValidatedField from "./validated-form/validated-field.vue";

	export type AlertProps = {
		title: string;
		message: string;
		type?: "alert" | "confirm";
		variant?: ThemeColour;
		show?: boolean;
		okLabel?: string;
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

	export async function showAlert(props: Omit<AlertProps, 'type' | 'show'>): Promise<void> {
		await renderAlert({ ...props, type: 'alert' });
	}

	export async function showConfirm(props: Omit<AlertProps, 'type' | 'show'>): Promise<boolean> {
		const result = await renderAlert({ ...props, type: 'confirm' });
		return result.ok;
	}

	export async function showPrompt({ initialValue = "", validate, ...props }: Omit<AlertProps, 'type' | 'show' | 'message'> & {
		initialValue?: string;
		/** Validate the value. Return an empty string or undefined to indicate validity. */
		validate?: (value: string) => string | undefined;
	}): Promise<string | undefined> {
		const value = ref(initialValue);
		const submitted = ref(false);
		const touched = ref(false);
		const inputRef = ref<HTMLInputElement>();

		const result = await renderAlert({
			...props,
			message: '',
			type: 'confirm',
			getContent: () => h(ValidatedField, {
				class: ['position-relative', touched.value ? 'was-validated' : ''],
				value: value.value,
				validators: validate ? [validate] as any : []
			}, {
				default: (slotProps: any) => [
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
						ref: (el) => {
							slotProps.inputRef(el);
							inputRef.value = el as any;
						}
					}),
					h('div', {
						class: "invalid-tooltip"
					}, slotProps.validationError)
				]
			}),
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
		okLabel: "OK"
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
		@shown="emit('shown')"
		@hide="emit('hide', result)"
		@hidden="emit('hidden', result)"
		@submit="handleSubmit"
		ref="modalRef"
	>
		<slot>{{props.message}}</slot>
	</ModalDialog>
</template>