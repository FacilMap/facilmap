<script setup lang="ts">
	import { type AnalyzedOsmRelation } from "facilmap-utils";
	import OsmFeatureInfo from "../osm-feature-info.vue";
	import SelectionCarousel from "../../ui/selection-carousel.vue";
	import type { SelectedItem } from "../../../utils/selection";
	import { injectContextRequired, requireMapContext } from "../../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);

	const props = withDefaults(defineProps<{
		relation: AnalyzedOsmRelation;
		/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
		unionZoom?: boolean;
		/** When clicking or selecting a search result, zoom to it. */
		autoZoom?: boolean;
	}>(), {
		unionZoom: false,
		autoZoom: false
	});
</script>

<template>
	<div class="fm-relation-results">
		<SelectionCarousel :selector="(s): s is Extract<SelectedItem, { type: 'osm' }> => s.type === 'osm'">
			<template #default="openItem">
				<OsmFeatureInfo
					:feature="props.relation"
					canOpenMember
					:unionZoom="props.unionZoom"
					:autoZoom="props.autoZoom"
					:zoom="mapContext.zoom"
					@open-member="(member) => openItem.open({ type: 'osm', feature: member })"
				></OsmFeatureInfo>
			</template>

			<template #openItem="openItem">
				<OsmFeatureInfo
					:feature="openItem.item.feature"
					showBackButton
					canOpenMember
					:unionZoom="props.unionZoom"
					:autoZoom="props.autoZoom"
					:zoom="mapContext.zoom"
					@back="openItem.close()"
					@open-member="(member) => openItem.open({ type: 'osm', feature: member })"
				></OsmFeatureInfo>
			</template>
		</SelectionCarousel>
	</div>
</template>

<style lang="scss">
	.fm-relation-results {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>