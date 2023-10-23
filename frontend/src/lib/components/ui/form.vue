<script setup lang="ts">
	import { ref } from 'vue';
	import { isPromise } from '../../utils/utils';
	import { toastErrors } from './toasts/toasts.vue';

	const emit = defineEmits<{
		(type: "submit"): void | Promise<void>;
	}>();

	const formRef = ref<HTMLFormElement>();
	const formTouched = ref(false);
	const isSubmitting = ref(false);

	const submit = toastErrors(async () => {
		formTouched.value = true;

		if (formRef.value!.checkValidity()) {
			const result = emit("submit");
			if (isPromise(result)) {
				isSubmitting.value = true;
				try {
					await result;
				} finally {
					isSubmitting.value = false;
				}
			}
		}
	});
</script>

<template>
	<form @submit.prevent="submit()" novalidate ref="formRef" :class="{ 'was-validated': formTouched }">
		<slot :is-submitting="isSubmitting"/>
	</form>
</template>