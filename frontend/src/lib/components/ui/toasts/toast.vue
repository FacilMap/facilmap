<script setup lang="ts">
	import { onBeforeUnmount, onMounted } from 'vue';
	import { useToasts } from './toasts.vue';
	import type { ToastOptions } from "./toasts.vue";

	const toasts = useToasts();

	const props = defineProps<Omit<ToastOptions, "onHidden"> & {
		id: string;
		title: string;
		message: string;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	onMounted(() => {
		const { id, title, message, ...options } = props;
		toasts.showToast(id, title, message, {
			...options,
			onHidden: () => {
				emit("hidden");
			}
		});
	});

	onBeforeUnmount(() => {
		toasts.hideToast(props.id);
	});
</script>