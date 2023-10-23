<script setup lang="ts">
	import { Point } from "facilmap-types";
	import copyToClipboard from "copy-to-clipboard";
	import { round } from "facilmap-utils";
	import Icon from "./icon.vue";
	import { computed } from "vue";
	import { showToast } from "./toasts/toasts.vue";
	import vTooltip from "../../utils/tooltip";

	const props = defineProps<{
		point: Point;
	}>();

	const formattedCoordinates = computed(() => `${round(props.point.lat, 5)}, ${round(props.point.lon, 5)}`);

	function copy(): void {
		copyToClipboard(formattedCoordinates.value);
		showToast(undefined, "Coordinates copied", "The coordinates were copied to the clipboard.", { variant: "success" });
	}
</script>

<template>
	<span class="fm-coordinates">
		<span>{{formattedCoordinates}}</span>
		<button
			type="button"
			class="btn btn-light"
		 	@click="copy()"
			v-tooltip="'Copy to clipboard'"
		>
			<Icon icon="copy" alt="Copy to clipboard"></Icon>
		</button>
	</span>
</template>

<style lang="scss">
	.fm-coordinates {
		button {
			margin-left: 0.5rem;
			padding: 0 0.25rem;
			line-height: 1;
			font-size: 0.85em;
			vertical-align: top;
		}
	}
</style>