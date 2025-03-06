<script setup lang="ts">
	import { coreIconList, getIconHtml } from "facilmap-leaflet";
	import { vHtmlAsync } from "../../utils/vue";
	import { computed, watchEffect } from "vue";

	const props = withDefaults(defineProps<{
		icon: string | undefined;
		alt?: string; // TODO
		size?: string;
		async?: boolean;
	}>(), {
		size: "1.35em"
	});

	watchEffect(() => {
		if (props.icon && !props.async && !coreIconList.includes(props.icon)) {
			console.warn(`Icon "${props.icon}" is not in core icons.`);
		}
	});

	const iconCodeP = computed(() => getIconHtml("currentColor", props.size, props.icon));
</script>

<template>
	<span class="fm-icon" :style="{ verticalAlign: `calc(-0.125em - (${props.size} - 1em) * 0.5)` }" v-html-async="iconCodeP"></span>
</template>

<style lang="scss">
	.fm-icon {
		display: inline-flex;
	}
</style>