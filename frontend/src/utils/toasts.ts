import { BvToastOptions } from "bootstrap-vue";
import { VNode } from "vue";

export interface ToastOptionsWithActions extends BvToastOptions {
	actions?: ToastAction[];
}

export interface ToastAction {
	onClick?: () => void;
	label: string;
	href?: string;
}

export function toastActions(component: Vue, message: string, actions?: ToastAction[]): VNode | string {
	if (!actions || actions.length == 0)
		return message;

	return component.$createElement(
		"div",
		{ class: "fm-toast-actions" },
		[
			component.$createElement("div", { }, message),
			...actions.map((action) => component.$createElement(
				"b-button",
				{
					props: { size: "sm", ...(action.href ? { href: action.href } : { }) },
					on: { ...(action.onClick ? { "click": action.onClick } : { }) },
				},
				action.label
			))
		]
	);
}

export function showErrorToast(component: Vue, id: string, title: string, err: any, options?: ToastOptionsWithActions): void {
	if (err.stack)
		console.error(err.stack);

	showToast(component, id, title, err.message || err, {
		variant: "danger",
		noCloseButton: false,
		...options
	});
}

export function showToast(component: Vue, id: string, title: string, message: string, options?: ToastOptionsWithActions): void {
	component.$bvToast.toast(toastActions(component, message, options?.actions), {
		id,
		title,
		noCloseButton: true,
		noAutoHide: true,
		...options
	});
}