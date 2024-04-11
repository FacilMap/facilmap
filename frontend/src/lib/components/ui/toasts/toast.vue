<script setup lang="ts">
	import { computed, onBeforeUnmount, onMounted } from "vue";
	import { useToasts } from "./toasts.vue";
	import type { ToastAction } from "./toasts.vue";
	import type { ThemeColour } from "../../../utils/bootstrap";

	/* eslint-disable vue/valid-template-root */

	const toasts = useToasts();

	const props = defineProps<{
		id: string;
		title: string;
		message: string | Error;
		actions?: ToastAction[];
		spinner?: boolean;
		variant?: ThemeColour;
		noCloseButton?: boolean;
		autoHide?: boolean;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const resolvedOptions = computed(() => ({
		actions: props.actions,
		spinner: props.spinner,
		variant: props.variant,
		noCloseButton: props.noCloseButton,
		autoHide: props.autoHide,
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