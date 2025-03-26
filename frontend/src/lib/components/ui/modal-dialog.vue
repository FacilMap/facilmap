<script setup lang="ts">
	import { computed, readonly, ref, toRef } from "vue";
	import { useModal } from "../../utils/modal";
	import ValidatedForm, { type CustomSubmitEvent } from "./validated-form/validated-form.vue";
	import type { ThemeColour } from "../../utils/bootstrap";
	import { useUnloadHandler } from "../../utils/utils";
	import AttributePreservingElement from "./attribute-preserving-element.vue";
	import { useI18n } from "../../utils/i18n";

	const i18n = useI18n();

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
		action?: string;
		target?: string;
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

	const modalElementRef = ref<InstanceType<typeof AttributePreservingElement>>();
	const modalRef = toRef(() => modalElementRef.value?.elementRef);
	const modal = useModal(modalRef, {
		onShown: () => {
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
			event.preventDefault();
			modal.hide();
		} else {
			if (!props.action) {
				event.preventDefault();
			}

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
		<AttributePreservingElement
			tag="div"
			class="modal fade fm-modal"
			:class="[
				props.size !== 'default' ? `modal-${props.size}` : '',
				props.class ?? ''
			]"
			tabindex="-1"
			aria-hidden="true"
			ref="modalElementRef"
		>
			<div class="modal-dialog modal-dialog-scrollable">
				<ValidatedForm
					class="modal-content"
					:action="props.action"
					:target="props.target"
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
							:aria-label="i18n.t('modal-dialog.close')"
						></button>
					</div>
					<div class="modal-body">
						<slot v-bind="expose"></slot>
					</div>
					<div class="modal-footer">
						<slot name="footer-left" v-bind="expose"></slot>

						<div style="flex-grow: 1"></div>

						<slot name="footer-right" v-bind="expose"></slot>

						<button
							v-if="!props.noCancel && !isCloseButton"
							type="button"
							class="btn btn-secondary"
							@click="modal.hide()"
							:disabled="isSubmitting || props.isBusy"
						>{{i18n.t('modal-dialog.cancel')}}</button>

						<button
							type="submit"
							class="btn btn-primary"
							:class="props.okVariant && `btn-${props.okVariant}`"
							:disabled="isSubmitting || props.isBusy"
						>
							<div v-if="isSubmitting" class="spinner-border spinner-border-sm"></div>
							{{props.okLabel ?? (isCloseButton ? i18n.t('modal-dialog.close') : i18n.t('modal-dialog.save'))}}
						</button>
					</div>
				</ValidatedForm>
			</div>
		</AttributePreservingElement>
	</Teleport>
</template>

<style lang="scss">
</style>