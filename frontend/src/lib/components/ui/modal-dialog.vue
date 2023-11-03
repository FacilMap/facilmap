<script setup lang="ts">
	import { computed, ref } from "vue";
	import { useModal } from "../../utils/modal";
	import ValidatedForm, { CustomSubmitEvent } from "./validated-form/validated-form.vue";
	import { reactiveReadonlyView } from "../../utils/vue";

	const props = withDefaults(defineProps<{
		title?: string;
		class?: string;
		/** If true, the user is prevented from closing the dialog. */
		noCancel?: boolean;
		isBusy?: boolean;
		/** If true, the Save button will always be shown (also if isModified is false). */
		isCreate?: boolean;
		/** If false, the Save button will be hidden (unless noCancel is true). */
		isModified?: boolean;
		size?: "sm" | "default" | "lg" | "xl";
		okLabel?: string;
	}>(), {
		isModified: false,
		size: "lg"
	});

	const emit = defineEmits<{
		hidden: [];
		submit: [event: CustomSubmitEvent];
	}>();

	const modalRef = ref<HTMLElement>();
	const modal = useModal(modalRef, { emit });

	const validatedFormRef = ref<InstanceType<typeof ValidatedForm>>();
	const isSubmitting = computed(() => validatedFormRef.value?.formData.isSubmitting);

	function handleSubmit(event: CustomSubmitEvent) {
		emit("submit", event);
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
			:data-bs-backdrop="isSubmitting || isBusy || props.noCancel ? 'static' : 'true'"
			:data-bs-keyboard="isSubmitting || isBusy || noCancel || isModified ? 'false' : 'true'"
			v-on="{
				'hide.bs.modal': (e: any) => {
					if (isSubmitting || isBusy) {
						e.preventDefault();
					}
				}
			}"
		>
			<div class="modal-dialog modal-dialog-scrollable">
				<ValidatedForm class="modal-content" @submit="handleSubmit" ref="validatedFormRef">
					<div class="modal-header">
						<h1 class="modal-title fs-5">{{props.title}}</h1>
						<button v-if="!noCancel" type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<slot v-bind="expose"></slot>
					</div>
					<div class="modal-footer">
						<slot name="footer-left" v-bind="expose"></slot>

						<div style="flex-grow: 1"></div>

						<button
							v-if="!noCancel"
							type="button"
							class="btn btn-secondary"
							:class="isModified || isCreate ? 'btn-secondary' : 'btn-primary'"
							@click="modal.hide()"
							:disabled="isSubmitting || isBusy"
						>{{isModified || isCreate ? 'Cancel' : 'Close'}}</button>

						<button
							v-if="noCancel || isModified || isCreate"
							type="submit"
							class="btn btn-primary"
							:disabled="isSubmitting || isBusy"
						>{{props.okLabel ?? 'Save'}}</button>
					</div>
				</ValidatedForm>
			</div>
		</div>
	</Teleport>
</template>

<style lang="scss">
</style>