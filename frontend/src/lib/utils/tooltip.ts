import { Tooltip } from "bootstrap";
import { Directive } from "vue";

declare global {
	interface Element {
		_fmTooltip?: Tooltip;
	}
}

declare module "bootstrap" {
	interface Tooltip {
		tip: Element | null;
		_newContent: Record<string, string> | null;
	}
}

const vTooltip: Directive<Element, string> = {
	mounted(el, binding) {
		el._fmTooltip = new Tooltip(el, {
			placement: (
				binding.modifiers.bottom ? 'bottom' :
				binding.modifiers.left ? 'left' :
				binding.modifiers.right ? 'right' :
				'top'
			),
			title: binding.value ?? '',
			trigger: 'hover'
		});
	},

	updated(el, binding) {
		if (el._fmTooltip) {
			el._fmTooltip._newContent = { '.tooltip-inner': binding.value };

			const tooltipInner = el._fmTooltip.tip?.querySelector<HTMLElement>('.tooltip-inner');
			if (tooltipInner) {
				tooltipInner.innerText = binding.value;
			}
		}
	},

	beforeUnmount(el) {
		if (el._fmTooltip) {
			el._fmTooltip.dispose();
		}
	}
}

export default vTooltip;
