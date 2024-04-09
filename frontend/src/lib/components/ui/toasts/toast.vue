<script setup lang="ts">
	import { computed, onBeforeUnmount, onMounted } from "vue";
	import { useToasts } from "./toasts.vue";
	import type { ToastOptions } from "./toasts.vue";

	/* eslint-disable vue/valid-template-root */

	const toasts = useToasts();

	const props = defineProps<{
		id: string;
		title: string;
		message: string | Error;
		options?: Omit<ToastOptions, "onHidden">;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const resolvedOptions = computed(() => ({
		...props.options,
		onHidden: () => {
			emit("hidden");
		}
	}));

	onMounted(() => {
		if (props.message instanceof Error) {
			toasts.showErrorToast(props.id, () => props.title, props.message, () => resolvedOptions.value);
		} else {
			toasts.showToast(props.id, () => props.title, () => props.message as string, () => resolvedOptions.value);
		}
	});

	onBeforeUnmount(() => {
		toasts.hideToast(props.id);
	});
</script>

<template>
</template>