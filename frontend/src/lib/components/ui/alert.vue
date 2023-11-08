<script lang="ts">
	import { computed, createApp, defineComponent, h, ref, type VNode, type VNodeArrayChildren, withDirectives } from "vue";
	import Alert from "./alert.vue";
	import vValidity from "./validated-form/validity";
	import { useModal } from "../../utils/modal";
	import type { ThemeColour } from "../../utils/bootstrap";

	export type AlertProps = {
		title: string;
		message: string;
		type?: "alert" | "confirm";
		variant?: ThemeColour;
		show?: boolean;
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
		const validationError = computed(() => submitted.value ? undefined : validate?.(value.value));
		const touched = ref(false);
		const inputRef = ref<HTMLInputElement>();

		const result = await renderAlert({
			...props,
			message: '',
			type: 'confirm',
			getContent: () => h('div', {
				class: touched.value ? 'was-validated' : ''
			}, [
				withDirectives(
					h('input', {
						type: "text",
						class: `form-control${touched.value ? ' was-validated' : ''}`,
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
		type: "alert"
	});

	const emit = defineEmits<{
		shown: [];
		hide: [result: AlertResult];
		hidden: [result: AlertResult];
	}>();

	const result = ref<AlertResult>({
		ok: false
	});

	const modalRef = ref<HTMLElement>();
	const modal = useModal(modalRef, {
		onShown: () => {
			emit('shown');
		},
		onHide: () => {
			emit('hide', result.value);
		},
		onHidden: () => {
			emit('hidden', result.value);
		}
	});

	const formRef = ref<HTMLFormElement>();
	const formTouched = ref(false);
	const handleSubmit = () => {
		if (formRef.value!.checkValidity()) {
			result.value.ok = true;
			modal.hide();
		} else {
			formTouched.value = true;
		}
	};
</script>

<template>
	<Teleport to="body">
		<div class="modal fade" tabindex="-1" aria-hidden="true" ref="modalRef">
			<div class="modal-dialog">
				<form class="modal-content" :class="{ 'was-validated': formTouched }" @submit.prevent="handleSubmit()" novalidate ref="formRef">
					<div class="modal-header">
						<h1 class="modal-title fs-5">{{props.title}}</h1>
						<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<slot>{{props.message}}</slot>
					</div>
					<div class="modal-footer">
						<button v-if="type === 'confirm'" type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
						<button type="submit" class="btn" :class="`btn-${props.variant ?? 'primary'}`">OK</button>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>