<script setup lang="ts">
	import { onBeforeUnmount, onMounted } from 'vue';
	import { hideToast, showToast } from './toasts.vue';
	import type { ToastOptions } from "./toasts.vue";

	const props = defineProps<Omit<ToastOptions, "onHidden"> & {
		id: string;
		title: string;
		message: string;
	}>();

	const emit = defineEmits<{
		(type: "hidden"): void;
	}>();

	onMounted(() => {
		const { id, title, message, ...options } = props;
		showToast(id, title, message, {
			...options,
			onHidden: () => {
				emit("hidden");
			}
		});
	});

	onBeforeUnmount(() => {
		hideToast(props.id);
	});
</script>