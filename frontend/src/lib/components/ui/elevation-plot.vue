<script setup lang="ts">
	import FmHeightgraph from "../../utils/heightgraph";
	import type { LineWithTrackPoints, RouteWithTrackPoints } from "facilmap-client";
	import { computed, markRaw, ref, toRef, watch } from "vue";
	import { useDomEventListener, useEventListener } from "../../utils/utils";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { fixOnCleanup } from "../../utils/vue";

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

	const elevationPlot = computed(() => {
		if (containerRef.value) {
			// Construct in computed value so that it is reconstructed on language change
			return markRaw(new FmHeightgraph({ mapMarkerPane: "lhl-raised" }));
		}
	});

	watch(elevationPlot, (value, oldValue, onCleanup_) => {
		const onCleanup = fixOnCleanup(onCleanup_);

		if (elevationPlot.value) {
			elevationPlot.value._map = mapContext.value.components.map;
			handleTrackPointsChange();
			containerRef.value!.append(elevationPlot.value.onAdd(mapContext.value.components.map));
			handleResize();

			onCleanup(() => {
				value!.onRemove(mapContext.value.components.map);
				containerRef.value!.replaceChildren();
			});
		}
	});

	function handleTrackPointsChange() {
		if (elevationPlot.value && props.route.trackPoints) {
			elevationPlot.value.addData(props.route.extraInfo ?? {}, props.route.trackPoints);
		}
	}

	watch(() => props.route.trackPoints, handleTrackPointsChange);

	function handleResize(): void {
		if (elevationPlot.value && containerRef.value) {
			elevationPlot.value.resize({ width: containerRef.value.offsetWidth, height: containerRef.value.offsetHeight });
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