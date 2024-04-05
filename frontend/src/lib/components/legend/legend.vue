<script setup lang="ts">
	import { round } from "facilmap-utils";
	import LegendContent from "./legend-content.vue";
	import { getLegendItems } from "./legend-utils";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { computed, ref } from "vue";
	import { useDomEventListener } from "../../utils/utils";
	import { useResizeObserver } from "../../utils/vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const absoluteContainerRef = ref<HTMLElement>();

	const scale = ref(1);

	useDomEventListener(window, "resize", updateMaxScale);
	useResizeObserver(absoluteContainerRef, updateMaxScale);
	updateMaxScale();

	function updateMaxScale(): void {
		if (absoluteContainerRef.value) {
			const mapContainer = mapContext.value.components.map.getContainer();
			const maxHeight = mapContainer.offsetHeight - 94;
			const maxWidth = mapContainer.offsetWidth - 20;

			const currentHeight = absoluteContainerRef.value.offsetHeight;
			const currentWidth = absoluteContainerRef.value.offsetWidth;

			const newScale = round(Math.min(1, maxHeight / currentHeight, maxWidth / currentWidth), 4);
			if (isFinite(newScale) && newScale != scale.value)
				scale.value = newScale;
		}
	}

	const legend1 = computed(() => {
		return client.value.padData?.legend1?.trim() || "";
	});

	const legend2 = computed(() => {
		return client.value.padData?.legend2?.trim() || "";
	});

	const legendItems = computed(() => {
		return getLegendItems(context);
	});
</script>

<template>
	<div class="fm-legend" v-if="legendItems.length > 0 || legend1 || legend2">
		<template v-if="!context.isNarrow">
			<div
				class="fm-legend-absolute card"
				:style="{ '--fm-scale-factor': scale }"
				ref="absoluteContainerRef"
			>
				<div class="card-body">
					<LegendContent :items="legendItems" :legend1="legend1" :legend2="legend2"></LegendContent>
				</div>
			</div>
		</template>
		<template v-else>
			<SearchBoxTab :id="`fm${context.id}-legend-tab`" :title="i18n.t('legend.tab-label')">
				<LegendContent :items="legendItems" :legend1="legend1" :legend2="legend2" no-popover></LegendContent>
			</SearchBoxTab>
		</template>
	</div>
</template>

<style lang="scss">
	.fm-legend-absolute.fm-legend-absolute {
		position: absolute;
		right: 10px;
		bottom: 25px;
		max-width: 20rem;
		z-index: 800;
		transform-origin: bottom right;
		opacity: .7;
		transition: opacity .7s;
		transform: scale(var(--fm-scale-factor));

		&:hover {
			opacity: 1;
		}

		.fm-legend-popover-wrapper {
			transform: scale(calc(1 / var(--fm-scale-factor)));
			transform-origin: center right;
		}
	}
</style>