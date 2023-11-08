<script setup lang="ts">
	import type { Point } from "facilmap-types";
	import copyToClipboard from "copy-to-clipboard";
	import { round } from "facilmap-utils";
	import Icon from "./icon.vue";
	import { computed } from "vue";
	import { useToasts } from "./toasts/toasts.vue";
	import vTooltip from "../../utils/tooltip";

	const toasts = useToasts();

	const props = defineProps<{
		point: Point;
	}>();

	const formattedCoordinates = computed(() => `${round(props.point.lat, 5)}, ${round(props.point.lon, 5)}`);

	function copy(): void {
		copyToClipboard(formattedCoordinates.value);
		toasts.showToast(undefined, "Coordinates copied", "The coordinates were copied to the clipboard.", { variant: "success", autoHide: true });
	}
</script>

<template>
	<span class="fm-coordinates">
		<span>{{formattedCoordinates}}</span>
		<button
			type="button"
			class="btn btn-secondary"
			@click="copy()"
			v-tooltip="'Copy to clipboard'"
		>
			<Icon icon="copy" alt="Copy to clipboard"></Icon>
		</button>
	</span>
</template>

<style lang="scss">
	.fm-coordinates {
		display: inline-flex;
		align-items: center;

		button {
			margin-left: 0.5rem;
			padding: 0 0.25rem;
			line-height: 1;
			font-size: 0.85em;
			vertical-align: top;
		}
	}
</style>