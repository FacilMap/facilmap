<script setup lang="ts">
	import { type StyleValue, computed, ref } from "vue";
	import HybridPopover, { hybridPopoverShouldUseModal } from "./hybrid-popover.vue";
	import { useDomEventListener, useNonClickFocusHandler, useNonDragClickHandler } from "../../utils/utils";
	import ValidatedField, { type Validator } from "./validated-form/validated-field.vue";

	const props = withDefaults(defineProps<{
		id?: string;
		customClass?: string;
		disabled?: boolean;
		validators?: Array<Validator<string>>;
		modelValue: string;
		/** If true, the width of the popover will be fixed to the width of the element. */
		enforceElementWidth?: boolean;
		previewStyle?: StyleValue;
	}>(), {
		enforceElementWidth: false,
		disabled: false
	});

	const emit = defineEmits<{
		keydown: [event: KeyboardEvent];
		"update:modelValue": [value: string];
		focusPopover: [];
	}>();

	const value = computed({
		get: () => props.modelValue,
		set: (value) => {
			emit("update:modelValue", value!);
		}
	});

	const focusFilterOnNextOpen = ref(false);
	const isOpen = ref(false);

	const containerRef = ref<HTMLElement>();
	const inputRef = ref<HTMLInputElement>();

	useDomEventListener(document.body, "keydown", handleBodyKeyDownCapture, { capture: true });
	useDomEventListener(document.body, "keydown", handleBodyKeyDown, { capture: true });

	function handleBodyKeyDownCapture(e: Event): void {
		if (isOpen.value) {
			const event = e as KeyboardEvent;
			if (event.key == "Enter") {
				inputRef.value?.focus();
				isOpen.value = false;
				event.preventDefault();
				event.stopPropagation();
			} else if (event.key == "Escape") {
				isOpen.value = false;
				event.preventDefault();
				event.stopPropagation();
				inputRef.value?.focus();
			}
		}
	}

	function handleBodyKeyDown(e: Event): void {
		if (isOpen.value) {
			emit("keydown", e as KeyboardEvent);
		}
	}

	function handleInputKeyDown(event: KeyboardEvent): void {
		if (["ArrowDown", "ArrowUp"].includes(event.key) && !isOpen.value) {
			focusFilterOnNextOpen.value = true;
			isOpen.value = true;
			event.preventDefault();
			event.stopPropagation();
		} else if (event.key == "Escape" && isOpen.value) {
			event.preventDefault();
			event.stopPropagation(); // Prevent closing outer modal
			isOpen.value = false;
		}
	}

	useNonClickFocusHandler(() => inputRef.value, () => {
		if (!hybridPopoverShouldUseModal.value) {
			open();
		}
	});
	useNonDragClickHandler(() => inputRef.value, open);

	function open() {
		focusFilterOnNextOpen.value = true;
		isOpen.value = true;
	}

	function handleInputDblClick() {
		focusFilterOnNextOpen.value = false;
		inputRef.value?.focus();
	}

	function handleToggleButtonClick() {
		if (isOpen.value) {
			isOpen.value = false;
		} else {
			open();
		}
	}

	function handleShown() {
		if (focusFilterOnNextOpen.value) {
			emit("focusPopover");
		}
	}
</script>

<template>
	<div class="fm-picker" ref="containerRef">
		<HybridPopover
			v-model:show="isOpen"
			:enforceElementWidth="props.enforceElementWidth"
			:customClass="props.customClass"
			@shown="handleShown"
			ignoreClick
		>
			<template #trigger>
				<ValidatedField
					:value="value"
					:validators="props.validators"
					class="input-group has-validation position-relative"
				>
					<template #default="slotProps">
						<span
							class="input-group-text"
							@click="inputRef?.focus()"
							:style="props.previewStyle"
						>
							<slot name="preview"></slot>
						</span>
						<input
							type="text"
							class="form-control"
							autocomplete="off"
							:disabled="disabled"
							v-model="value"
							:id="id"
							:ref="(r) => { inputRef = r as any; slotProps.inputRef(r) }"
							@keydown="handleInputKeyDown"
							@dblclick="handleInputDblClick"
						/>
						<button
							type="button"
							class="btn btn-secondary dropdown-toggle"
							:class="{ active: isOpen }"
							tabindex="-1"
							@click="handleToggleButtonClick()"
						></button>
						<div class="invalid-tooltip">
							{{slotProps.validationError}}
						</div>
					</template>
				</ValidatedField>
			</template>

			<template #default="{ isModal, close }">
				<slot :is-modal="isModal" :close="close"></slot>
			</template>
		</HybridPopover>
	</div>
</template>

<style lang="scss">
	.fm-picker-modal {
		display: flex;
		flex-direction: column;
	}
</style>