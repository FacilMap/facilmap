import Tooltip from "bootstrap/js/dist/tooltip";
import type { Directive } from "vue";

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

const allTooltips = new Set<Tooltip>();

export function hideAllTooltips(): void {
	for (const tooltip of allTooltips) {
		tooltip.hide();
	}
}

export type TooltipPlacement = "top" | "left" | "right" | "bottom";

const updateTooltip: Directive<Element, string | undefined> = (el, binding) => {
	if (binding.value) {
		if (!el._fmTooltip) {
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
			allTooltips.add(el._fmTooltip);
		}

		el._fmTooltip._newContent = { '.tooltip-inner': binding.value ?? "" };

		const tooltipInner = el._fmTooltip.tip?.querySelector<HTMLElement>('.tooltip-inner');
		if (tooltipInner) {
			tooltipInner.innerText = binding.value;
		}
	} else if (el._fmTooltip) {
		disposeTooltip(el);
	}
};

const disposeTooltip = (el: Element): void => {
	if (el._fmTooltip) {
		allTooltips.delete(el._fmTooltip);
		el._fmTooltip.dispose();
		delete el._fmTooltip;
	}
}

const vTooltip: Directive<Element, string | undefined> = {
	mounted: updateTooltip,
	updated: updateTooltip,
	beforeUnmount: disposeTooltip
}

export default vTooltip;
