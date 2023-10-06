<script setup lang="ts">
	import { ref } from "vue";
	import { useModal } from "../../../utils/modal";

	const props = withDefaults(defineProps<{
		show?: boolean;
		title?: string;
		dialogClass?: string;
		noCancel?: boolean;
		isSaving?: boolean;
		isBusy?: boolean;
		isCreate?: boolean;
		isModified?: boolean;
		size?: "sm" | "default" | "lg" | "xl";
		okTitle?: string;
	}>(), {
		isModified: true,
		size: "lg"
	});

	const emit = defineEmits<{
		(type: "hidden"): void;
		(type: "submit"): void;
	}>();

	const modal = useModal({ emit });

	const formRef = ref<HTMLFormElement>();
	const formTouched = ref(false);

	const submit = () => {
		if (formRef.value!.checkValidity()) {
			emit("submit");
		} else {
			formTouched.value = true;
		}
	};
</script>

<template>
	<Teleport to="body">
		<div
			class="modal fade fm-form-modal"
			:class="[
				props.size !== 'default' ? `modal-${props.size}` : undefined,
				dialogClass
			]"
			tabindex="-1"
			aria-hidden="true"
			:ref="modal.ref"
			:data-bs-backdrop="isSaving || isBusy || props.noCancel ? 'static' : 'true'"
			:data-bs-keyboard="isSaving || isBusy || noCancel || isModified ? 'false' : 'true'"
			@hide.bs.modal="(isSaving || isBusy) && $event.preventDefault()"
		>
			<div class="modal-dialog">
				<form class="modal-content" @submit.prevent="submit()" novalidate ref="formRef" :class="{ 'was-validated': formTouched }">
					<div class="modal-header">
						<h1 class="modal-title fs-5">{{props.title}}</h1>
						<button v-if="!noCancel" type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<slot></slot>
					</div>
					<div class="modal-footer">
						<slot name="footer-left"></slot>

						<div style="flex-grow: 1"></div>

						<button
							v-if="!noCancel"
							type="button"
							class="btn btn-light"
							@click="modal.hide()"
							:disabled="isSaving || isBusy"
						>Cancel</button>

						<button
							v-if="noCancel || isModified || isCreate"
							type="submit"
							class="btn btn-primary"
							@click="submit()"
							:disabled="isSaving || isBusy"
						>OK</button>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>

<style lang="scss">
</style>