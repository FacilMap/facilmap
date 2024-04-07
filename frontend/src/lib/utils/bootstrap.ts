import { computed, type Ref, ref } from "vue";
import maxSize from "popper-max-size-modifier";
import type { Modifier, ModifierArguments } from "@popperjs/core";

const breakpointMinWidth = {
	// See https://getbootstrap.com/docs/5.3/layout/breakpoints/#available-breakpoints
	xs: 0,
	sm: 576,
	md: 768,
	lg: 992,
	xl: 1200,
	xxl: 1400
};

export type Breakpoint = keyof typeof breakpointMinWidth;

export const breakpoints = Object.keys(breakpointMinWidth) as Breakpoint[];

const update = ref(0);

const mediaQueries = Object.fromEntries(Object.entries(breakpointMinWidth).map(([breakpoint, minWidth]) => {
	const query = matchMedia(`(min-width: ${minWidth}px)`);
	query.addEventListener("change", () => {
		update.value++
	});
	return [breakpoint, query];
}));

export const reactiveBreakpoint = computed(() => {
	update.value;
	return [...breakpoints].reverse().find((breakpoint) => mediaQueries[breakpoint].matches) ?? 'xs';
});

export function isMaxBreakpoint(breakpoint: Breakpoint): boolean {
	return breakpoints.indexOf(reactiveBreakpoint.value) <= breakpoints.indexOf(breakpoint);
}

/**
 * Returns a reactive boolean that is true if the current breakpoint is the specified one or smaller.
 */
export function useMaxBreakpoint(breakpoint: Breakpoint): Ref<boolean> {
	return computed(() => isMaxBreakpoint(breakpoint));
}

/**
 * Returns a reactive boolean that is true if the current breakpoint is the specified one or larger.
 */
export function useMinBreakpoint(breakpoint: Breakpoint): Ref<boolean> {
	return computed(() => breakpoints.indexOf(reactiveBreakpoint.value) >= breakpoints.indexOf(breakpoint));
}

export type ThemeColour = "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "light" | "dark";
export type ButtonVariant = ThemeColour | "link" | "outline-primary" | "outline-secondary" | "outline-success" | "outline-danger" | "outline-warning" | "outline-info" | "outline-light" | "outline-dark";
export type ButtonSize = "lg" | "sm";

/**
 * An array of popper modifiers that uses popper-max-size-modifier to shrink the popover to prevent overflow
 * rather than move it, as is the default in Bootstrap.
 */
export const getMaxSizeModifiers = ({ maxWidth = "30rem" }: { maxWidth?: string } = {}): Array<Partial<Modifier<any, any>>> => [
	{
		...maxSize,
		options: {
			padding: 5
		}
	},
	{
		name: 'applyMaxSize',
		enabled: true,
		phase: 'beforeWrite',
		requires: ['maxSize'],
		fn({ state }: ModifierArguments<any>): void {
			// The `maxSize` modifier provides this data
			const {width, height} = state.modifiersData.maxSize;

			state.styles.popper = {
				...state.styles.popper,
				maxWidth: `min(${maxWidth}, ${width}px)`,
				maxHeight: `${height}px`
			}
		}
	}
];
