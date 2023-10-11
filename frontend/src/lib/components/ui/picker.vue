<script setup lang="ts">
	import { onBeforeUnmount, ref, watchEffect } from "vue";
	import { injectContextRequired } from "../../../utils/context";
	import { getUniqueId } from "../../../utils/utils";

	const context = injectContextRequired();

	const props = withDefaults(defineProps<{
		id?: string;
		customClass?: string;
		expand?: boolean;
		disabled?: boolean;
		validationError?: string;
		value?: string;
	}>(), {
		id: () => getUniqueId("fm-picker"),
		expand: false,
		disabled: false
	});

	const isOpen = ref(false);

	const container = ref<HTMLElement>();
	const input = ref<HTMLInputElement>();
	const modalInner = ref<HTMLElement>();

	const popoverOpen = ref(false);
	const modalOpen = ref(false);
	const uniqueClass = getUniqueId("fm-picker-unique");
	const styleEl = ref<HTMLElement>();
	const blurTimeout = ref<ReturnType<typeof setTimeout>>();
	const isPopoverMouseDown = ref(false);

	watchEffect((onCleanup) => {
		if (isOpen) {
			document.body.addEventListener("mousedown", handleBodyMouseDown, true);
			document.body.addEventListener("keydown", handleBodyKeyDown);

			onCleanup(() => {
				document.body.addEventListener("mousedown", handleBodyMouseDown, true);
				document.body.addEventListener("keydown", handleBodyKeyDown);
			});
		}
	});

	onBeforeUnmount(() => {
		document.body.removeEventListener("mousedown", this.handleBodyMouseDown, true);
		document.body.removeEventListener("keydown", this.handleBodyKeyDown);
		if (this.styleEl)
			this.styleEl.remove();
	});

	@Watch("popoverOpen")
	handlePopoverOpenChange(popoverOpen: boolean): void {
		if (popoverOpen)
			document.body.addEventListener("mousedown", this.handleBodyMouseDown, true);
		else
			document.body.removeEventListener("mousedown", this.handleBodyMouseDown, true);
	}

	@Watch("open")
	handleOpenChange(modalOpen: boolean): void {
		if (modalOpen)
			document.body.addEventListener("keydown", this.handleBodyKeyDown);
		else
			document.body.removeEventListener("keydown", this.handleBodyKeyDown);
	}

	function handleInputClick(): void {
		this.open = true;
	}

	function handleInputBlur(): void {
		if (this.popoverOpen && !this.isPopoverMouseDown) {
			this.blurTimeout = setTimeout(() => {
				this.popoverOpen = false;
			}, 0);
		}
	}

	function handleBodyMouseDown(event: MouseEvent): void {
		if ((event.target as HTMLElement).closest(`#${this.id}-container,.${this.uniqueClass}`)) {
			this.isPopoverMouseDown = true;
			setTimeout(() => {
				this.isPopoverMouseDown = false;
			}, 0);

			if (this.blurTimeout) {
				clearTimeout(this.blurTimeout);
				this.blurTimeout = null;
			}
		} else if (this.popoverOpen)
			this.popoverOpen = false;
	}

	function handleBodyKeyDown(event: KeyboardEvent): void {
		if (event.key == "Enter") {
			document.getElementById(this.id)!.focus();
			this.modalOpen = false;
			this.popoverOpen = false;
			event.preventDefault();
		} else if (["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) {
			this.$emit("keydown", event);
		} else if (event.key == "Escape" && this.popoverOpen) {
			this.popoverOpen = false;
			event.preventDefault();
			document.getElementById(this.id)!.focus();
		}
	}

	function handleInputKeyDown(event: KeyboardEvent): void {
		if (["ArrowDown", "ArrowUp"].includes(event.key)) {
			if (!this.open) {
				this.open = true;
				event.preventDefault();
			} else
				this.$emit("keydown", event);
			event.stopPropagation(); // To not be picked up by handleBodyKeyDown()
		} else if (event.key == "Escape" && this.popoverOpen) {
			event.preventDefault();
			event.stopPropagation(); // Prevent closing outer modal
			this.popoverOpen = false;
		}
	}

	function handlePopoverFocus(): void {
		if (this.blurTimeout) {
			clearTimeout(this.blurTimeout);
			this.blurTimeout = null;
		}
	}

	function handleOpenPopover(): void {
		if (this.expand) {
			styleEl.value = document.createElement("style");
			styleEl.value!.innerHTML = `.fm-picker-popover.${this.uniqueClass} { max-width: none; width: ${this.container.offsetWidth}px }`;
			document.querySelector("head")!.appendChild(this.styleEl);
		}
	}

	function handleClosePopover(): void {
		this.styleEl?.remove();
		this.styleEl = null;
	}

	function close(): void {
		this.open = false;
	}
</script>

<template>
	<div :id="`${id}-container`" class="fm-picker" ref="container">
		<div class="input-group" :id="`${id}-input-group`">
			<span class="input-group-text" @click="input?.focus()">
				<slot name="preview"></slot>
			</span>
			<input
				type="text"
				class="form-control"
				autocomplete="off"
				:disabled="disabled"
				:value="value"
				v-validity="props.validationError"
				:id="id"
				@update="$emit('input', $event)"
				@blur="handleInputBlur"
				@click="handleInputClick"
				ref="input"
				@keydown="handleInputKeyDown"
			>
		</div>

		<!-- <b-popover
			:target="`${id}-input-group`"
			:container="body"
			triggers="manual"
			placement="bottom"
			:fallback-placement="[]"
			:custom-class="`fm-picker-popover ${uniqueClass} ${customClass}`"
			:delay="0"
			boundary="viewport"
			@show="handleOpenPopover"
			@hidden="handleClosePopover"
			:show.sync="popoverOpen"
		>
			<div @focusin.stop="handlePopoverFocus" class="fm-field-popover-content">
				<slot :is-modal="false" :close="close"></slot>
			</div>
		</b-popover>

		<b-modal
			:id="`${id}-modal`"
			v-model="modalOpen"
			:body-class="`fm-picker-modal ${customClass}`"
			ok-only
			hide-header
			scrollable
		>
			<slot :is-modal="true" :close="close"></slot>
		</b-modal> -->
	</div>
</template>

<style lang="scss">
	.fm-picker-modal {
		display: flex;
		flex-direction: column;
	}
</style>