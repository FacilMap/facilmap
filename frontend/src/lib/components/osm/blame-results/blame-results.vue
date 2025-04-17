<script setup lang="ts">
	import { useI18n } from "../../../utils/i18n";
	import { getOsmFeatureLabel, getOsmFeatureName, type OsmFeatureBlame, type OsmFeatureBlameSection } from "facilmap-utils";
	import { computed, toRaw } from "vue";
	import { injectContextRequired, requireMapContext } from "../../facil-map-context-provider/facil-map-context-provider.vue";
	import { getZoomDestinationForBbox, getZoomDestinationForFeatureBlameSection } from "../../../utils/zoom";
	import ZoomToObjectButton from "../../ui/zoom-to-object-button.vue";
	import OsmFeatureLink from "../osm-feature-link.vue";
	import BlameSectionInfo from "./blame-section-info.vue";
	import type { ResultsItem } from "../../ui/results.vue";
	import Results from "../../ui/results.vue";
	import SelectionCarousel from "../../ui/selection-carousel.vue";
	import type { SelectedItem } from "../../../utils/selection";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		blame: OsmFeatureBlame;
		/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
		unionZoom?: boolean;
		/** When clicking or selecting a search result, zoom to it. */
		autoZoom?: boolean;
	}>(), {
		unionZoom: false,
		autoZoom: false
	});

	const zoomDestination = computed(() => getZoomDestinationForBbox(props.blame.bbox));

	const activeSections = computed(() => props.blame.sections.filter((s) => mapContext.value.selection.some((i) => i.type === "featureBlame" && toRaw(i.section) === toRaw(s))));

	const sectionItems = computed(() => props.blame.sections.map((section, i): ResultsItem<OsmFeatureBlameSection> => ({
		key: i,
		object: section,
		iconColour: `#${section.user.colour}`,
		icon: "square",
		label: (
			section.changeset.tags.comment ? i18n.t("blame-results.section-label-with-comment", { username: section.user.name, timestamp: section.timestamp, comment: section.changeset.tags.comment })
			: i18n.t("blame-results.section-label", { username: section.user.name, timestamp: section.timestamp })
		),
		ellipsisOverflow: true,
		zoomDestination: getZoomDestinationForFeatureBlameSection(section),
		zoomTooltip: i18n.t('blame-results.zoom-to-section-tooltip'),
		canOpen: true,
		openTooltip: i18n.t('blame-results.show-details-tooltip')
	})));

	const heading = computed(() => {
		const name = getOsmFeatureName(props.blame.feature.tags ?? {}, i18n.currentLanguage);
		return getOsmFeatureLabel(props.blame.feature.type, props.blame.feature.id, name);
	});

	function selectSection(section: OsmFeatureBlameSection): void {
		mapContext.value.components.selectionHandler.setSelectedItems([{ type: "featureBlame", section }]);
	}
</script>

<template>
	<div class="fm-blame-results">
		<SelectionCarousel :selector="(item): item is Extract<SelectedItem, { type: 'featureBlame' }> => item.type === 'featureBlame'">
			<template #default="openSection">
				<div class="fm-search-box-collapse-point">
					<h2>{{heading}}</h2>

					<Results
						:items="sectionItems"
						:active="activeSections"
						:unionZoom="props.unionZoom"
						:autoZoom="props.autoZoom"
						@select="(section) => selectSection(section)"
						@open="(section) => openSection.open({ type: 'featureBlame', section })"
					></Results>
				</div>
				<div class="btn-toolbar mt-2">
					<ZoomToObjectButton
						:label="i18n.t('blame-results.zoom-to-feature-label')"
						size="sm"
						:destination="zoomDestination"
					></ZoomToObjectButton>

					<OsmFeatureLink
						class="btn btn-secondary btn-sm"
						:type="props.blame.feature.type"
						:id="props.blame.feature.id"
						label="OpenStreetMap"
					></OsmFeatureLink>
				</div>
			</template>

			<template #openItem="openSection">
				<BlameSectionInfo
					:section="openSection.item.section"
					showBackButton
					:zoom="mapContext.zoom"
					@back="openSection.close()"
				></BlameSectionInfo>
			</template>
		</SelectionCarousel>
	</div>
</template>

<style lang="scss">
	.fm-blame-results {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>