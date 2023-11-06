<script setup lang="ts">
	import FmHeightgraph from "../../utils/heightgraph";
	import type { LineWithTrackPoints, RouteWithTrackPoints } from "facilmap-client";
	import { onBeforeUnmount, onMounted, ref, toRef, watch } from "vue";
	import { useDomEventListener, useEventListener } from "../../utils/utils";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const props = defineProps<{
		route: RouteWithTrackPoints | LineWithTrackPoints;
	}>();

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const searchBoxContext = toRef(() => context.components.searchBox);

	useEventListener(searchBoxContext, "resizeend", handleResize);
	useEventListener(searchBoxContext, "resizereset", handleResize);

	useDomEventListener(window, "resize", handleResize);

	const containerRef = ref<HTMLElement>();

	let elevationPlot: FmHeightgraph | undefined;

	onMounted(() => {
		elevationPlot = new FmHeightgraph();
		elevationPlot._map = mapContext.value.components.map;

		handleTrackPointsChange();

		containerRef.value!.append(elevationPlot.onAdd(mapContext.value.components.map));
		handleResize();
	});

	onBeforeUnmount(() => {
		elevationPlot!.onRemove(mapContext.value.components.map);
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