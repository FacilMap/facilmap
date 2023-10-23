<script setup lang="ts">
	import { getSymbolHtml } from "facilmap-leaflet";
	import { computed } from "vue";

	const props = withDefaults(defineProps<{
		icon: string | undefined;
		alt?: string; // TODO
		size?: string;
	}>(), {
		size: "1.35em"
	});

	const iconCode = computed(() => getSymbolHtml("currentColor", props.size, props.icon));
</script>

<template>
	<span class="fm-icon" v-html="iconCode"></span>
</template>

<style lang="scss">
</style>