import { Directive } from "vue";

const vValidity: Directive<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, string> = {
	mounted(el, binding) {
		el.setCustomValidity(binding.value ?? "");
	},

	updated(el, binding) {
		el.setCustomValidity(binding.value ?? "");
	}
}

export default vValidity;
