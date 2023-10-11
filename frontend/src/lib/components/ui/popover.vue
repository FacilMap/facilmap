<script lang="ts">
	import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
	import { Popover } from "bootstrap";

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
	const props = defineProps<{
		element: HTMLElement | undefined;
		show: boolean;
		hideOnOutsideClick?: boolean;
	}>();

	const emit = defineEmits<{
		(type: "update:show", show: boolean): void;
	}>();

	const popoverContent = ref<HTMLElement | null>(null);
	const renderPopover = ref(false);

	const show = async () => {
		renderPopover.value = true;
		await nextTick();
		if (props.element) {
			CustomPopover.getOrCreateInstance(props.element, {
				placement: 'bottom',
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

	watch(() => props.element, (el, prevEl) => {
		if (prevEl) {
			prevEl.removeEventListener("hidden.bs.popover", handleHidden);
			CustomPopover.getInstance(prevEl)?.dispose();
		}

		if (props.element) {
			props.element.addEventListener("hidden.bs.popover", handleHidden);
		}
	}, { immediate: true });

	watch(() => props.show && !!props.element, async (shouldShow) => {
		if (shouldShow) {
			show();
		} else {
			hide();
		}
	}, { immediate: true });

	const handleDocumentClick = (e: MouseEvent) => {
		if (props.hideOnOutsideClick && e.target instanceof Node && !props.element?.contains(e.target) && !popoverContent.value?.contains(e.target)) {
			hide();
		}
	};

	onMounted(() => {
		document.addEventListener('click', handleDocumentClick, { capture: true });
	});

	onBeforeUnmount(() => {
		document.removeEventListener('click', handleDocumentClick, { capture: true });
		if (props.element) {
			CustomPopover.getInstance(props.element)?.dispose()
		}
	});
</script>

<template>
	<div v-if="renderPopover" class="popover fade bs-popover-auto" ref="popoverContent">
		<div class="popover-arrow"></div>
		<h3 class="popover-header">
			<slot name="header"></slot>
		</h3>
		<div class="popover-body">
			<slot></slot>
		</div>
	</div>
</template>