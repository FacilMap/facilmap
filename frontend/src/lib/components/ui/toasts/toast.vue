<script setup lang="ts">
	import { onBeforeUnmount, onMounted } from "vue";
	import { useToasts } from "./toasts.vue";
	import type { ToastOptions } from "./toasts.vue";

	/* eslint-disable vue/valid-template-root */

	const toasts = useToasts();

	const props = defineProps<Omit<ToastOptions, "onHidden"> & {
		id: string;
		title: string;
		message: string | Error;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	onMounted(() => {
		const { id, title, message, ...options } = props;
		const resolvedOptions: ToastOptions = {
			...options,
			onHidden: () => {
				emit("hidden");
			}
		};
		if (message instanceof Error) {
			toasts.showErrorToast(id, title, message, resolvedOptions);
		} else {
			toasts.showToast(id, title, message, resolvedOptions);
		}
	});

	onBeforeUnmount(() => {
		toasts.hideToast(props.id);
	});
</script>

<template>
</template>