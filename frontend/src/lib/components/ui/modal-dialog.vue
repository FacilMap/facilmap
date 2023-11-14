<script setup lang="ts">
	import { computed, readonly, ref, toRef } from "vue";
	import { useModal } from "../../utils/modal";
	import ValidatedForm, { type CustomSubmitEvent } from "./validated-form/validated-form.vue";
	import type { ThemeColour } from "../../utils/bootstrap";
	import { useUnloadHandler } from "../../utils/utils";

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
		okLabel?: string;
		okVariant?: ThemeColour;
		formValidationError?: string | undefined;
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
			const focusEl = (
				modalRef.value?.querySelector<HTMLElement>("[autofocus],.fm-autofocus")
				?? modalRef.value?.querySelector<HTMLElement>("input:not([type=button]):not([type=hidden]):not([type=image]):not([type=reset]):not([type=submit]),textarea,select")
				?? submitRef.value
			);
			focusEl?.focus();

			emit("shown");
		},
		onHide: () => {
			emit("hide");
		},
		onHidden: () => {
			emit("hidden");
		},
		static: computed(() => isSubmitting.value || props.isBusy || props.noCancel || props.isModified),
		noEscape: computed(() => isSubmitting.value || props.isBusy || props.noCancel)
	});

	useUnloadHandler(() => props.isModified);

	const isCloseButton = computed(() => !props.isCreate && !props.isModified);

	function handleSubmit(event: CustomSubmitEvent) {
		if (isCloseButton.value) {
			modal.hide();
		} else {
			emit("submit", event);
		}
	}

	const expose = readonly({
		formData: toRef(() => validatedFormRef.value?.formData),
		modal
	});
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
		>
			<div class="modal-dialog modal-dialog-scrollable">
				<ValidatedForm
					class="modal-content"
					@submit="handleSubmit"
					ref="validatedFormRef"
					:noValidate="isCloseButton"
					:formValidationError="formValidationError"
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