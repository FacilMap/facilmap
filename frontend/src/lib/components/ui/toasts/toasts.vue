<script lang="ts">
	/// <reference types="vite/client" />

	import { createApp, nextTick, onScopeDispose, reactive, ref, type App } from "vue";
	import Toast from "bootstrap/js/dist/toast";
	import Toasts from "./toasts.vue";
	import { mapRef } from "../../../utils/vue";
	import { getUniqueId } from "../../../utils/utils";
	import type { ThemeColour } from "../../../utils/bootstrap";

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
		variant?: ThemeColour;
		noCloseButton?: boolean;
		autoHide?: boolean;
		onHide?: () => void;
		onHidden?: () => void;
	}

	export interface ToastAction {
		onClick?: (e: MouseEvent) => void;
		label: string;
		href?: string;
		variant?: ThemeColour;
	}

	interface ToastInstance extends ToastOptions {
		key: string;
		id: string | undefined;
		title: string;
		message: string;
		contextId: string;
	}

	export const toastContainer = document.createElement("div");
	toastContainer.classList.add("fm-toast-container");
	document.body.appendChild(toastContainer);

	let app: App | undefined;
	const appMountP = Promise.resolve().then(() => {
		app = createApp(Toasts);
		app.mount(toastContainer);
	}).catch((err) => {
		console.error("Error rendering toast container", err);
	});
	import.meta.hot?.dispose(() => {
		app?.unmount();
		toastContainer.remove();
	});

	const toasts = ref<ToastInstance[]>([]);
	const toastRefs = reactive(new Map<ToastInstance, HTMLElement>());

	export function useToasts(noScope = false): ToastContext {
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
						const res = callback(...args);
						Promise.resolve(res).catch((err) => {
							void result.showErrorToast(undefined, 'Unexpected error', err);
							throw err;
						});
						return res;
					} catch (err: any) {
						void result.showErrorToast(undefined, 'Unexpected error', err);
					}
				}) as C;
			},

			showToast: async (id, title, message, options = {}) => {
				await appMountP;
				if (id != null) {
					void result.hideToast(id);
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

		if (!noScope) {
			onScopeDispose(() => {
				result.dispose();
			});
		}

		return result;
	}

	async function showToastInstance(toast: ToastInstance): Promise<void> {
		await new Promise<void>((resolve) => {
			const toastRef = toastRefs.get(toast)!;
			toastRef.addEventListener("shown.bs.toast", () => resolve());
			Toast.getOrCreateInstance(toastRef, { autohide: !!toast.autoHide }).show();

			toastRef.addEventListener("hide.bs.toast", () => {
				toast.onHide?.();
			});

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
	<div class="toast-container position-fixed top-0 end-0 p-3 fm-toasts">
		<div
			v-for="toast in toasts"
			:key="toast.key"
			class="toast"
			:class="{ 'border-0': toast.variant }"
			role="alert"
			aria-live="assertive"
			aria-atomic="true"
			:ref="mapRef(toastRefs, toast)"
		>
			<div
				class="toast-header bg-opacity-25 text-break"
				:class="toast.variant && `bg-${toast.variant} bg-opacity-25`"
			>
				<strong class="me-auto">{{toast.title}}</strong>
				<button v-if="!toast.noCloseButton" type="button" class="btn-close" @click="hideToastInstance(toast)" aria-label="Close"></button>
			</div>
			<div
				class="toast-body bg-opacity-10 text-break"
				:class="toast.variant && `bg-${toast.variant} bg-opacity-10`"
			>
				<div>
					<div v-if="toast.spinner" class="spinner-border spinner-border-sm" role="status">
						<span class="visually-hidden">Loading...</span>
					</div>
					{{toast.message}}
				</div>

				<div v-if="(toast.actions?.length ?? 0) > 0" class="btn-toolbar mt-2 pt-2 border-top">
					<template v-for="(action, idx) in toast.actions" :key="idx">
						<button
							v-if="!action.href"
							type="button"
							class="btn btn-sm"
							:class="`btn-${action.variant ?? 'secondary'}`"
							@click="action.onClick"
						>{{action.label}}</button>

						<a
							v-if="action.href"
							:href="action.href"
							class="btn btn-sm"
							:class="`btn-${action.variant ?? 'secondary'}`"
							@click="action.onClick"
						>{{action.label}}</a>
					</template>
				</div>
			</div>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-toast-container {
		position: absolute;
		z-index: 10002; /* Above .fm-leaflet-map-disabled-cover */
	}
</style>