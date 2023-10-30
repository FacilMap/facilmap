<script setup lang="ts">
	import { ref, watchEffect } from "vue";
	import HybridPopover from "./hybrid-popover.vue";

	const props = withDefaults(defineProps<{
		id?: string;
		customClass?: string;
		disabled?: boolean;
		validationError?: string;
		value?: string;
		/** If true, the width of the popover will be fixed to the width of the element. */
		enforceElementWidth?: boolean;
	}>(), {
		enforceElementWidth: false,
		disabled: false
	});

	const emit = defineEmits<{
		(type: "keydown", event: KeyboardEvent): void;
		(type: "input", value: string): void;
	}>();

	const isOpen = ref(false);

	const containerRef = ref<HTMLElement>();
	const inputRef = ref<HTMLInputElement>();

	watchEffect((onCleanup) => {
		if (isOpen.value) {
			document.body.addEventListener("keydown", handleBodyKeyDown);

			onCleanup(() => {
				document.body.addEventListener("keydown", handleBodyKeyDown);
			});
		}
	});

	function handleBodyKeyDown(event: KeyboardEvent): void {
		if (event.key == "Enter") {
			inputRef.value?.focus();
			isOpen.value = false;
			event.preventDefault();
		} else if (["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) {
			emit("keydown", event);
		} else if (event.key == "Escape" && isOpen.value) {
			isOpen.value = false;
			event.preventDefault();
			inputRef.value?.focus();
		}
	}

	function handleInputKeyDown(event: KeyboardEvent): void {
		if (["ArrowDown", "ArrowUp"].includes(event.key)) {
			if (!isOpen.value) {
				isOpen.value = true;
				event.preventDefault();
			} else
				emit("keydown", event);
			event.stopPropagation(); // To not be picked up by handleBodyKeyDown()
		} else if (event.key == "Escape" && isOpen.value) {
			event.preventDefault();
			event.stopPropagation(); // Prevent closing outer modal
			isOpen.value = false;
		}
	}
</script>

<template>
	<div class="fm-picker" ref="containerRef">
		<HybridPopover
			v-model:show="isOpen"
			:enforceElementWidth="props.enforceElementWidth"
		>
			<template #trigger>
				<div class="input-group">
					<span class="input-group-text" @click="inputRef?.focus()">
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
						@update="emit('input', $event)"
						ref="inputRef"
						@keydown="handleInputKeyDown"
					>
				</div>
				<div class="invalid-feedback" v-if="props.validationError">
					{{props.validationError}}
				</div>
			</template>

			<template #default="{ isModal, close }">
				<slot :is-modal="isModal" :close="close"></slot>
			</template>
		</HybridPopover>

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