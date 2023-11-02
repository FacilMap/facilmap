<script setup lang="ts">
	import FmHeightgraph from "../../utils/heightgraph";
	import type { LineWithTrackPoints, RouteWithTrackPoints } from "facilmap-client";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";
	import { injectSearchBoxContextOptional } from "../search-box/search-box-context.vue";
	import { onBeforeUnmount, onMounted, ref, watch } from "vue";
	import { useDomEventListener, useEventListener } from "../../utils/utils";

	const props = defineProps<{
		route: RouteWithTrackPoints | LineWithTrackPoints;
	}>();

	const mapContext = injectMapContextRequired();
	const searchBoxContext = injectSearchBoxContextOptional();



	if (searchBoxContext) {
		useEventListener(searchBoxContext, "resizeend", handleResize);
		useEventListener(searchBoxContext, "resizereset", handleResize);
	}

	useDomEventListener(window, "resize", handleResize);

	const containerRef = ref<HTMLElement>();

	let elevationPlot: FmHeightgraph | undefined;

	onMounted(() => {
		elevationPlot = new FmHeightgraph();
		elevationPlot._map = mapContext.components.map;

		handleTrackPointsChange();

		containerRef.value!.append(elevationPlot.onAdd(mapContext.components.map));
		handleResize();
	});

	onBeforeUnmount(() => {
		elevationPlot!.onRemove(mapContext.components.map);
	});

	function handleTrackPointsChange() {
		if (elevationPlot && props.route.trackPoints) {
			elevationPlot.addData(props.route.extraInfo, props.route.trackPoints);
		}
	}

	watch(() => props.route.trackPoints, handleTrackPointsChange);

	function handleResize(): void {
		if (elevationPlot && containerRef.value) {
			elevationPlot.resize({ width: containerRef.value.offsetWidth, height: containerRef.value.offsetHeight });
		}
	}
</script>

<template>
	<div class="fm-elevation-plot" ref="containerRef"></div>
</template>

<style lang="scss">
	.fm-elevation-plot {
		flex-grow: 1;
		flex-basis: 12rem;
		overflow: hidden;
		min-height: 6.5rem;

		.heightgraph-toggle, .heightgraph-close-icon {
			display: none !important;
		}
	}
</style>