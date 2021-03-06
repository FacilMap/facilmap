import { BvToastOptions } from "bootstrap-vue";
import { VNode } from "vue";

export interface ToastAction {
	onClick: () => void;
	label: string;
}

export function toastActions(component: Vue, message: string, actions: ToastAction[]): VNode {
	return component.$createElement(
		"div",
		{ class: "fm-toast-actions" },
		[
			component.$createElement("div", { }, message),
			...actions.map((action) => component.$createElement(
				"b-button",
				{ props: { size: "sm" }, on: { "click": action.onClick } },
				action.label
			))
		]
	);
}

export function showErrorToast(component: Vue, id: string, title: string, err: any, options?: BvToastOptions): void {
	console.error(err.stack || err);

	component.$bvToast.toast(err.message || err, {
		id,
		title,
		variant: "danger",
		noAutoHide: true,
		...options
	});
}

export function showActionToast(component: Vue, id: string, title: string, message: string, actions: ToastAction[], options?: BvToastOptions): void {
	component.$bvToast.toast(toastActions(component, message, actions), {
		id,
		title,
		noCloseButton: true,
		noAutoHide: true,
		...options
	});
}