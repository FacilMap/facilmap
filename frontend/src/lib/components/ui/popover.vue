<script lang="ts">
	import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
	import { Popover, Tooltip } from "bootstrap";
	import { useResizeObserver } from "../../utils/vue";

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
		placement?: Tooltip.PopoverPlacement
	}>(), {
		placement: "bottom"
	});

	const emit = defineEmits<{
		"update:show": [show: boolean];
	}>();

	const popoverContent = ref<HTMLElement | null>(null);
	const renderPopover = ref(false);

	const show = async () => {
		renderPopover.value = true;
		await nextTick();
		if (props.element) {
			CustomPopover.getOrCreateInstance(props.element, {
				placement: props.placement,
				content: popoverContent.value!,
				trigger: 'manual'
			}).show();
		}
	};

	const hide = () => {
		if (props.element) {
			CustomPopover.getInstance(props.element)?.hide(); // Will be destroyed by hidden.bs.popover event listener
		}

		if (props.show) {
			emit("update:show", false);
		}
	};

	const handleHidden = () => {
		if (props.element) {
			CustomPopover.getInstance(props.element)?.dispose();
		}
		renderPopover.value = false;
	};

	watch([
		() => props.element,
		() => props.placement
	], ([el], oldValues, onCleanup) => {
		if (el) {
			el.addEventListener("hidden.bs.popover", handleHidden);

			if (props.show) {
				show();
			}

			onCleanup(() => {
				el.removeEventListener("hidden.bs.popover", handleHidden);
				CustomPopover.getInstance(el)?.dispose();
			});
		}
	}, { immediate: true });

	watch(() => props.show, () => {
		if (props.element) {
			if (props.show) {
				show();
			} else {
				hide();
			}
		}
	}, { immediate: true });

	const handleDocumentClick = (e: MouseEvent) => {
		if (props.hideOnOutsideClick && e.target instanceof Node && !props.element?.contains(e.target) && !popoverContent.value?.contains(e.target)) {
			hide();
		}
	};

	onMounted(() => {
		document.addEventListener('click', handleDocumentClick, { capture: true });

		// TODO: Handle element blur (and focus?)
	});

	onBeforeUnmount(() => {
		document.removeEventListener('click', handleDocumentClick, { capture: true });
		if (props.element) {
			CustomPopover.getInstance(props.element)?.dispose()
		}
	});

	const elementSize = useResizeObserver(computed(() => props.enforceElementWidth ? props.element : undefined));
</script>

<template>
	<div
		v-if="renderPopover"
		class="popover fade bs-popover-auto"
		ref="popoverContent"
		:style="props.enforceElementWidth && elementSize ? { maxWidth: 'none', width: `${elementSize.contentRect.width}px` } : undefined"
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