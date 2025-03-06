<script setup lang="ts">
	import { ref, watch } from "vue";
	import vTooltip from "../../utils/tooltip";
	import { useResizeObserver } from "../../utils/vue";

	const props = defineProps<{
		value: string;
	}>();

	const containerRef = ref<HTMLElement>();

	const size = useResizeObserver(containerRef);

	const isOverflow = ref(false);
	watch(size, () => {
		isOverflow.value = !!containerRef.value && containerRef.value.offsetWidth < containerRef.value.scrollWidth;
	}, { immediate: true });
</script>

<template>
	<span class="fm-ellipsis-overflow" ref="containerRef" v-tooltip="isOverflow ? props.value : undefined">
		{{value}}
	</span>
</template>

<style lang="scss">
	.fm-ellipsis-overflow {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>