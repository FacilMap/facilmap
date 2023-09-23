<script setup lang="ts">
	const props = defineProps<{
		desktop: string;
		mobile: string;
	}>();
</script>

<template>
	<div class="fm-screenshot">
		<img :src="props.desktop">
		<img :src="props.mobile">
	</div>
</template>

<style lang="scss">
	.fm-screenshot {
		display: flex;
		gap: 6px;

		> :nth-child(1) {
			width: calc(68.5% - 3px);
		}

		> :nth-child(2) {
			width: calc(31.5% - 3px);
		}
	}
</style>