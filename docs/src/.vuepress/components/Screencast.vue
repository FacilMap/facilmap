<script setup lang="ts">
	const props = defineProps<{
		desktop: string;
		mobile: string;
	}>();
</script>

<template>
	<div class="fm-screencast">
		<video controls>
			<source :src="props.desktop">
		</video>
		<video controls>
			<source :src="props.mobile">
		</video>
	</div>
</template>

<style lang="scss">
	.fm-screencast {
		display: flex;
		gap: 6px;

		> :nth-child(1) {
			width: calc(66.5% - 3px);
		}

		> :nth-child(2) {
			width: calc(33.5% - 3px);
		}
	}
</style>