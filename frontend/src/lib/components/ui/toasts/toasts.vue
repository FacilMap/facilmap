<script lang="ts">
	import { createApp, nextTick, onScopeDispose, reactive, ref } from "vue";
	import { Toast } from "bootstrap";
	import Toasts from "./toasts.vue";
	import { mapRef } from "../../../utils/vue";
	import { getUniqueId } from "../../../utils/utils";

	export interface ToastContext {
		showErrorToast(id: string | undefined, title: string, err: any, options?: ToastOptions): Promise<void>;
		toastErrors<C extends (...args: any[]) => any>(callback: C): C;
		showToast(id: string | undefined, title: string, message: string, options?: ToastOptions): Promise<void>;
		hideToast(id: string): Promise<void>;
		dispose(): void;
	}

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
		key: string;
		id: string | undefined;
		title: string;
		message: string;
		contextId: string;
	}

	export const toastContainer = document.createElement("div");
	document.body.appendChild(toastContainer);
	const appMountP = Promise.resolve().then(() => {
		createApp(Toasts).mount(toastContainer);
	}).catch((err) => {
		console.error("Error rendering toast container", err);
	});

	const toasts = ref<ToastInstance[]>([]);
	const toastRefs = reactive(new Map<ToastInstance, HTMLElement>());

	export function useToasts(): ToastContext {
		const contextId = getUniqueId("fm-toast-context");
		const result: ToastContext = {
			showErrorToast: async (id, title, err, options) => {
				if (err.stack)
					console.error(err.stack);

				await result.showToast(id, title, err.message || err, {
					variant: "danger",
					noCloseButton: false,
					...options
				});
			},

			toastErrors: <C extends (...args: any[]) => any>(callback: C) => {
				return ((...args) => {
					try {
						const result = callback(...args);
						Promise.resolve(result).catch((err) => {
							result.showErrorToast(undefined, 'Unexpected error', err);
							throw err;
						});
						return result;
					} catch (err: any) {
						result.showErrorToast(undefined, 'Unexpected error', err);
					}
				}) as C;
			},

			showToast: async (id, title, message, options = {}) => {
				await appMountP;
				if (id != null) {
					result.hideToast(id);
				}

				const toast: ToastInstance = { ...options, key: getUniqueId("fm-toast"), id, title, message, contextId };
				toasts.value.push(toast);

				await nextTick();

				await showToastInstance(toast);
			},

			hideToast: async (id) => {
				const toastsToHide = toasts.value.filter((t) => t.contextId === contextId && t.id === id);
				await Promise.all(toastsToHide.map(async (toast) => {
					await hideToastInstance(toast);
				}));
			},

			dispose: async () => {
				const toastsToHide = toasts.value.filter((t) => t.contextId === contextId);
				await Promise.all(toastsToHide.map(async (toast) => {
					await hideToastInstance(toast);
				}));
			}
		};

		onScopeDispose(() => {
			result.dispose();
		});

		return result;
	}

	async function showToastInstance(toast: ToastInstance): Promise<void> {
		await new Promise<void>((resolve) => {
			const toastRef = toastRefs.get(toast)!;
			toastRef.addEventListener("shown.bs.toast", () => resolve());
			Toast.getOrCreateInstance(toastRef, { autohide: !toast.noAutoHide }).show();

			toastRef.addEventListener("hidden.bs.toast", () => {
				toasts.value = toasts.value.filter((t) => t !== toast);
				toastRefs.delete(toast);
				toast.onHidden?.();
			});
		});
	}

	async function hideToastInstance(toast: ToastInstance): Promise<void> {
		await appMountP;
		await new Promise<void>((resolve) => {
			const toastRef = toastRefs.get(toast)!;
			toastRef.addEventListener("hidden.bs.toast", () => resolve());
			Toast.getInstance(toastRef)!.hide();
		});
	}
</script>

<script setup lang="ts">
	// This script must not be empty, otherwise Vue assumes this component is using the Options API
</script>

<template>
	<div class="toast-container position-fixed top-0 end-0 p-3">
		<div
			v-for="toast in toasts"
			:key="toast.key"
			class="toast"
			role="alert"
			aria-live="assertive"
			aria-atomic="true"
			:ref="mapRef(toastRefs, toast)"
		>
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
					<template v-for="(action, idx) in toast.actions" :key="idx">
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