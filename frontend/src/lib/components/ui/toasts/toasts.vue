<script lang="ts">
	import { createApp, Ref, nextTick, reactive, ref } from "vue";
	import { Toast } from "bootstrap";
	import Toasts from "./toasts.vue";

	export interface ToastOptions {
		actions?: ToastAction[];
		spinner?: boolean;
		variant?: "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "light" | "dark";
		noCloseButton?: boolean;
		noAutoHide?: boolean;
		onHidden?: () => void;
	}

	export interface ToastAction {
		onClick?: (e: MouseEvent) => void;
		label: string;
		href?: string;
	}

	interface ToastInstance extends ToastOptions {
		id: string | undefined;
		title: string;
		message: string;
	}

	export const toastContainer = document.createElement("div");
	document.body.appendChild(toastContainer);
	createApp(Toasts).mount(toastContainer);

	const toasts = ref<ToastInstance[]>([]);
	const toastRefs = reactive(new Map<ToastInstance, Ref<HTMLElement | undefined>>());

	export async function showErrorToast(id: string | undefined, title: string, err: any, options?: ToastOptions): Promise<void> {
		if (err.stack)
			console.error(err.stack);

		await showToast(id, title, err.message || err, {
			variant: "danger",
			noCloseButton: false,
			...options
		});
	}

	export async function toastErrors<C extends (...args: any[]) => any>(callback: C): C {
		return ((...args) => {
			try {
				const result = callback(...args);
				Promise.resolve(result).catch((err) => {
					showErrorToast(undefined, 'Unexpected error', err);
					throw err;
				});
				return result;
			} catch (err: any) {
				showErrorToast(undefined, 'Unexpected error', err);
			}
		}) as C;
	}

	export async function showToast(id: string | undefined, title: string, message: string, options: ToastOptions = {}): Promise<void> {
		if (id != null) {
			hideToast(id);
		}

		const toast: ToastInstance = { ...options, id, title, message };
		const toastRef = ref<HTMLElement | undefined>();
		toasts.value.push(toast);
		toastRefs.set(toast, toastRef);

		await nextTick();

		await new Promise<void>((resolve) => {
			toastRef.value!.addEventListener("shown.bs.toast", () => resolve());
			Toast.getOrCreateInstance(toastRef.value!, { autohide: !options.noAutoHide }).show();

			toastRef.value!.addEventListener("hidden.bs.toast", () => {
				toasts.value = toasts.value.filter((t) => t !== toast);
				toastRefs.delete(toast);
				toast.onHidden?.();
			});
		});
	}

	async function hideToastInstance(toast: ToastInstance): Promise<void> {
		await new Promise<void>((resolve) => {
			const toastRef = toastRefs.get(toast)!;
			toastRef.value!.addEventListener("hidden.bs.toast", () => resolve());
			Toast.getInstance(toastRef.value!)!.hide();
		});
	}

	export async function hideToast(id: string): Promise<void> {
		const toastsToHide = toasts.value.filter((t) => t.id === id);
		await Promise.all(toastsToHide.map(async (toast) => {
			await hideToastInstance(toast);
		}));
	}
</script>

<script setup lang="ts">
</script>

<template>
	<div class="toast-container position-fixed bottom-0 end-0 p-3">
		<div v-for="toast in toasts" class="toast" role="alert" aria-live="assertive" aria-atomic="true" :ref="toastRefs.get(toast)">
			<div class="toast-header">
				<strong class="me-auto">{{toast.title}}</strong>
				<button v-if="!toast.noCloseButton" type="button" class="btn-close" @click="hideToastInstance(toast)" aria-label="Close"></button>
			</div>
			<div class="toast-body">
				<div>
					<div v-if="toast.spinner" class="spinner-border spinner-border-sm" role="status">
						<span class="visually-hidden">Loading...</span>
					</div>
					{{toast.message}}
				</div>

				<div class="fm-toast-actions">
					<template v-for="action in toast.actions">
						<button
							v-if="!action.href"
							type="button"
							class="btn btn-light btn-sm"
							@click="action.onClick"
						>{{action.label}}</button>

						<a
							v-if="action.href"
							:href="action.href"
							class="btn btn-light btn-sm"
							@click="action.onClick"
						>{{action.label}}</a>
					</template>
				</div>
			</div>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-toast-actions {
		button + button {
			margin-left: 5px;
		}
	}
</style>