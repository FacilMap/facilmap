<script setup lang="ts">
	import Collapse from "bootstrap/js/dist/collapse";
	import { onBeforeUnmount, onMounted, ref, watch } from "vue";

	const props = withDefaults(defineProps<{
		show?: boolean;
	}>(), {
		show: false
	});

	const containerRef = ref<HTMLElement>();
	const collapseRef = ref<Collapse>();

	onMounted(() => {
		collapseRef.value = new Collapse(containerRef.value!, { toggle: false });

		watch(() => props.show, () => {
			if (props.show) {
				collapseRef.value?.show();
			} else {
				collapseRef.value?.hide();
			}
		}, { immediate: true });
	});

	onBeforeUnmount(() => {
		collapseRef.value?.dispose();
	});
</script>

<template>
	<div ref="containerRef" class="collapse">
		<slot />
	</div>
</template>