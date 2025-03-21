<script setup lang="ts">
	import { type AnalyzedOsmRelation, type ResolvedOsmFeature } from "facilmap-utils";
	import OsmFeatureInfo from "../osm-feature-info.vue";
	import SelectionCarousel from "../../ui/selection-carousel.vue";
	import { injectContextRequired, requireMapContext } from "../../facil-map-context-provider/facil-map-context-provider.vue";
	import { computed, ref, type DeepReadonly } from "vue";
	import type { ComponentExposed } from "vue-component-type-helpers";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);

	const props = withDefaults(defineProps<{
		relation: AnalyzedOsmRelation;
		active?: boolean;
		/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
		unionZoom?: boolean;
		/** When clicking or selecting a search result, zoom to it. */
		autoZoom?: boolean;
	}>(), {
		active: true,
		unionZoom: false,
		autoZoom: false
	});

	const selectionRef = ref<ComponentExposed<typeof SelectionCarousel<DeepReadonly<ResolvedOsmFeature>>>>();
	const activeRelation = computed(() => selectionRef.value?.items.findLastIndex((item) => item.type === "relation") ?? -1);
</script>

<template>
	<div class="fm-relation-results">
		<component :is="SelectionCarousel<DeepReadonly<ResolvedOsmFeature>>" ref="selectionRef" :selector="undefined">
			<template #default="openItem">
				<OsmFeatureInfo
					:feature="props.relation"
					:active="props.active"
					:visible="activeRelation == -1"
					canOpenMember
					:unionZoom="props.unionZoom"
					:autoZoom="props.autoZoom"
					:zoom="mapContext.zoom"
					@open-member="(member) => openItem.open(member)"
				></OsmFeatureInfo>
			</template>

			<template #openItem="openItem">
				<OsmFeatureInfo
					:feature="openItem.item"
					:active="props.active"
					:visible="(openItem.item.type !== 'relation' && openItem.active) || activeRelation === openItem.level"
					showBackButton
					canOpenMember
					:unionZoom="props.unionZoom"
					:autoZoom="props.autoZoom"
					:zoom="mapContext.zoom"
					@back="openItem.close()"
					@open-member="(member) => openItem.open(member)"
				></OsmFeatureInfo>
			</template>
		</component>
	</div>
</template>

<style lang="scss">
	.fm-relation-results {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>