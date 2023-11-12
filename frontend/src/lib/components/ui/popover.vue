<script lang="ts">
	import { computed, ref, toRef, watch, watchEffect } from "vue";
	import { Popover, Tooltip } from "bootstrap";
	import { useResizeObserver } from "../../utils/vue";
	import { getUniqueId, useDomEventListener } from "../../utils/utils";

	/**
	 * Like Bootstrap Popover, but uses an existing popover element rather than creating a new one. This way, the popover
	 * content can be made reactive.
	 */
	export class CustomPopover extends Popover {
		declare _popper: any;
		contentEl: Element;

		constructor(element: string | Element, options: Partial<Popover.Options> & { content: Element }) {
			super(element, {
				...options,
				content: ' '
			});
			this.contentEl = options.content;
		}

		_createTipElement(): Element {
			// Return content element rather than creating a new one
			return this.contentEl;
		}

		_disposePopper(): void {
			// Do not remove content element here
			if (this._popper) {
				this._popper.destroy()
				this._popper = null
			}
		}
	}
</script>

<script lang="ts" setup>
	const props = withDefaults(defineProps<{
		element: HTMLElement | undefined;
		show: boolean;
		hideOnOutsideClick?: boolean;
		/** If true, the width of the popover will be fixed to the width of the element. */
		enforceElementWidth?: boolean;
		placement?: Tooltip.PopoverPlacement;
	}>(), {
		placement: "bottom"
	});

	const emit = defineEmits<{
		"update:show": [show: boolean];
		shown: [];
		hide: [];
		hidden: [];
	}>();

	const popoverContent = ref<HTMLElement>();
	const renderPopover = ref(false);

	watchEffect((onCleanup) => {
		onCleanup(() => {}); // TODO: Delete me https://github.com/vuejs/core/issues/5151#issuecomment-1515613484

		if (props.element && popoverContent.value) {
			const popover = new CustomPopover(props.element, {
				placement: props.placement,
				content: popoverContent.value,
				trigger: 'manual',
				popperConfig: (defaultConfig) => ({
					...defaultConfig,
					strategy: "fixed"
				})
			});
			popover.show();

			onCleanup(() => {
				popover.dispose();
			});
		}
	});

	useDomEventListener(toRef(() => props.element), "shown.bs.popover", () => {
		emit("shown");
	});

	useDomEventListener(toRef(() => props.element), "hide.bs.popover", () => {
		emit("hide");
	});

	useDomEventListener(toRef(() => props.element), "hidden.bs.popover", () => {
		renderPopover.value = false;
		emit("hidden");
	});

	watch(() => props.show, (show) => {
		renderPopover.value = show;
	});

	useDomEventListener(() => props.element, "focusout", (e: Event) => {
		const event = e as FocusEvent;
		// relatedTarget == null: target is out of viewport (ignore to allow focussing dev tools)
		if (event.relatedTarget && !popoverContent.value?.contains(event.relatedTarget as Node) && !props.element?.contains(event.relatedTarget as Node)) {
			emit("update:show", false);
		}
	});

	function handlePopoverFocusOut(event: FocusEvent) {
		// relatedTarget == null: target is out of viewport (ignore to allow focussing dev tools)
		if (event.relatedTarget && !popoverContent.value?.contains(event.relatedTarget as Node) && !props.element?.contains(event.relatedTarget as Node)) {
			emit("update:show", false);
		}
	}

	useDomEventListener(document, "click", (e: Event) => {
		if (props.show && props.hideOnOutsideClick && e.target instanceof Node && !props.element?.contains(e.target) && !popoverContent.value?.contains(e.target)) {
			emit("update:show", false);
		}
	}, { capture: true });

	const elementSize = useResizeObserver(computed(() => props.enforceElementWidth ? props.element : undefined));
</script>

<template>
	<div
		v-if="renderPopover"
		class="popover fm-popover fade bs-popover-auto"
		ref="popoverContent"
		:style="props.enforceElementWidth && elementSize ? { maxWidth: 'none', width: `${elementSize.contentRect.width}px` } : undefined"
		@focusout="handlePopoverFocusOut"
		:tabindex="-1 /* Allow focusing by click (for focusout event relatedTarget), do not allow focusing by tab */"
	>
		<div class="popover-arrow"></div>
		<h3 v-if="$slots.header" class="popover-header">
			<slot name="header"></slot>
		</h3>
		<div class="popover-body">
			<slot></slot>
		</div>
	</div>
</template>