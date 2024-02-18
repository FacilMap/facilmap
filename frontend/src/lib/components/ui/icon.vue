<script setup lang="ts">
	import { getSymbolHtml } from "facilmap-leaflet";
	import { vHtmlAsync } from "../../utils/vue";
	import { computed } from "vue";

	const props = withDefaults(defineProps<{
		icon: string | undefined;
		alt?: string; // TODO
		size?: string;
	}>(), {
		size: "1.35em"
	});

	const iconCodeP = computed(() => getSymbolHtml("currentColor", props.size, props.icon));
</script>

<template>
	<span class="fm-icon" v-html-async="iconCodeP"></span>
</template>

<style lang="scss">
</style>