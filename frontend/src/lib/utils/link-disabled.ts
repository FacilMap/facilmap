import type { Directive } from "vue";

const vLinkDisabled: Directive<HTMLAnchorElement, boolean> = (el, binding) => {
	if (binding.value) {
		el.classList.add("disabled");
		el.setAttribute("aria-disabled", "true");
		el.setAttribute("tabindex", "-1");
	} else {
		el.classList.remove("disabled");
		el.removeAttribute("aria-disabled");
		el.removeAttribute("tabindex");
	}
};

export default vLinkDisabled;