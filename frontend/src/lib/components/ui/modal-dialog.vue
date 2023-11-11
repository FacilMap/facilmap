<script setup lang="ts">
	import { computed, ref } from "vue";
	import { useModal } from "../../utils/modal";
	import ValidatedForm, { type CustomSubmitEvent } from "./validated-form/validated-form.vue";
	import { reactiveReadonlyView } from "../../utils/vue";
	import type { ThemeColour } from "../../utils/bootstrap";

	const props = withDefaults(defineProps<{
		title?: string;
		class?: string;
		/** If true, the user is prevented from closing the dialog. */
		noCancel?: boolean;
		isBusy?: boolean;
		/** If true, the Save button will always be shown (also if isModified is false). */
		isCreate?: boolean;
		/** If false, a Close button will be shown instead of a Save button (except is isCreate is true). */
		isModified?: boolean;
		size?: "sm" | "default" | "lg" | "xl";
		/**
		 * If specified, the dialog will be shrunk a bit to make the underlying dialog partly visible in case of stacked dialogs.
		 * 0 represents a non-stacked dialog (default), 1 should be the first stacked dialog, ...
		 */
		stackLevel?: number;
		okLabel?: string;
		okVariant?: ThemeColour;
		/** If true, the OK button is focused when the dialog is opened. */
		okFocus?: boolean;
	}>(), {
		isModified: false,
		size: "lg"
	});

	const emit = defineEmits<{
		shown: [];
		hide: [];
		hidden: [];
		submit: [event: CustomSubmitEvent];
	}>();

	const validatedFormRef = ref<InstanceType<typeof ValidatedForm>>();
	const isSubmitting = computed(() => validatedFormRef.value?.formData.isSubmitting);
	const submitRef = ref<HTMLElement>();

	const modalRef = ref<HTMLElement>();
	const modal = useModal(modalRef, {
		onShown: () => {
			if (props.okFocus) {
				submitRef.value?.focus();
			} else {
				modalRef.value?.querySelector<HTMLElement>("[autofocus],.fm-autofocus")?.focus();
			}

			emit("shown");
		},
		onHide: () => {
			emit("hide");
		},
		onHidden: () => {
			emit("hidden");
		},
		static: computed(() => isSubmitting.value || props.isBusy || props.noCancel || props.isModified)
	});

	const isCloseButton = computed(() => !props.isCreate && !props.isModified);

	function handleSubmit(event: CustomSubmitEvent) {
		if (isCloseButton.value) {
			modal.hide();
		} else {
			emit("submit", event);
		}
	}

	const expose = reactiveReadonlyView(() => ({
		formData: validatedFormRef.value?.formData,
		modal
	}));
	defineExpose(expose);
</script>

<template>
	<Teleport to="body">
		<div
			class="modal fade fm-modal"
			:class="[
				props.size !== 'default' ? `modal-${props.size}` : undefined,
				props.class
			]"
			tabindex="-1"
			aria-hidden="true"
			ref="modalRef"
			:data-bs-backdrop="isSubmitting || props.isBusy || props.noCancel || props.isModified ? 'static' : 'true'"
			:data-bs-keyboard="isSubmitting || props.isBusy || props.noCancel || props.isModified ? 'false' : 'true'"
		>
			<div class="modal-dialog modal-dialog-scrollable" :style="props.stackLevel ? { padding: `${20*props.stackLevel}px ${40*props.stackLevel}px` } : undefined">
				<ValidatedForm
					class="modal-content"
					@submit="handleSubmit"
					ref="validatedFormRef"
					:noValidate="isCloseButton"
				>
					<div class="modal-header">
						<h1 class="modal-title fs-5">{{props.title}}</h1>
						<button
							v-if="!props.noCancel"
							:disabled="isSubmitting || props.isBusy"
							@click="modal.hide()"
							type="button"
							class="btn-close"
							aria-label="Close"
						></button>
					</div>
					<div class="modal-body">
						<slot v-bind="expose"></slot>
					</div>
					<div class="modal-footer">
						<slot name="footer-left" v-bind="expose"></slot>

						<div style="flex-grow: 1"></div>

						<button
							v-if="!props.noCancel && !isCloseButton"
							type="button"
							class="btn btn-secondary"
							@click="modal.hide()"
							:disabled="isSubmitting || props.isBusy"
						>Cancel</button>

						<button
							type="submit"
							class="btn btn-primary"
							:class="props.okVariant && `btn-${props.okVariant}`"
							:disabled="isSubmitting || props.isBusy"
							ref="submitRef"
						>{{props.okLabel ?? (isCloseButton ? 'Close' : 'Save')}}</button>
					</div>
				</ValidatedForm>
			</div>
		</div>
	</Teleport>
</template>

<style lang="scss">
</style>