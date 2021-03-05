import Vue, { VNode } from "vue";
import "./toast-actions.scss";

export interface ToastAction {
	onClick: () => void;
	label: string;
}

export default function toastActions(component: Vue, message: string, actions: ToastAction[]): VNode {
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