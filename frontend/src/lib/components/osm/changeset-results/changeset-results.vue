<script setup lang="ts">
	import { useI18n } from "../../../utils/i18n";
	import { renderOsmTag, type AnalyzedChangeset, type ChangesetFeature } from "facilmap-utils";
	import { computed, toRaw } from "vue";
	import { injectContextRequired, requireMapContext } from "../../facil-map-context-provider/facil-map-context-provider.vue";
	import { getZoomDestinationForBbox, getZoomDestinationForChangesetFeature } from "../../../utils/zoom";
	import ZoomToObjectButton from "../../ui/zoom-to-object-button.vue";
	import ChangesetFeatureInfo from "./changeset-feature-info.vue";
	import { getChangesetFeatureLabel } from "../utils";
	import { isEqual } from "lodash-es";
	import OsmFeatureLink from "../osm-feature-link.vue";
	import type { ResultsItem } from "../../ui/results.vue";
	import Results from "../../ui/results.vue";
	import type { SelectedItem } from "../../../utils/selection";
	import SelectionCarousel from "../../ui/selection-carousel.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		changeset: AnalyzedChangeset;
		/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
		unionZoom?: boolean;
		/** When clicking or selecting a search result, zoom to it. */
		autoZoom?: boolean;
	}>(), {
		unionZoom: false,
		autoZoom: false
	});

	const zoomDestination = computed(() => props.changeset.bbox && getZoomDestinationForBbox(props.changeset.bbox));

	const activeFeatures = computed(() => props.changeset.features.filter((f) => mapContext.value.selection.some((i) => i.type === "changeset" && i.feature === f)));

	const featureItems = computed(() => props.changeset.features.map((feature): ResultsItem<ChangesetFeature> => {
		const hasTagChanges = (
			(feature.old && feature.new && !isEqual(toRaw(feature.old.tags ?? {}), toRaw(feature.new.tags ?? {})))
			|| (!feature.old && Object.keys(feature.new.tags ?? {}).length > 0)
			|| (feature.type === "relation" && feature.old && feature.new && !isEqual(toRaw(feature.old.members), toRaw(feature.new.members)))
		);
		return {
			key: `${feature.type}-${feature.id}`,
			object: feature,
			icon: (
				!feature.new ? "square-minus" :
				!feature.old ? "square-plus" :
				"square"
			),
			iconTooltip: (
				!feature.new ? i18n.t("changeset-results.deleted-tooltip") :
				!feature.old ? i18n.t("changeset-results.created-tooltip") :
				i18n.t("changeset-results.modified-tooltip")
			),
			className: (
				!feature.new ? "deleted" :
				!feature.old ? "created" :
				"modified"
			),
			label: getChangesetFeatureLabel(feature),
			zoomDestination: getZoomDestinationForChangesetFeature(feature),
			zoomTooltip: i18n.t('changeset-results.zoom-to-feature-tooltip'),
			canOpen: hasTagChanges ? true : "faded",
			openTooltip: hasTagChanges ? i18n.t('changeset-results.show-details-tooltip') : feature.type === 'relation' ? i18n.t('changeset-results.show-details-no-tag-member-changes-tooltip') : i18n.t('changeset-results.show-details-no-tag-changes-tooltip')
		};
	}));

	function selectFeature(feature: ChangesetFeature): void {
		mapContext.value.components.selectionHandler.setSelectedItems([{ type: "changeset", feature }]);
	}
</script>

<template>
	<div class="fm-changeset-results">
		<SelectionCarousel :selector="(item): item is Extract<SelectedItem, { type: 'changeset' }> => item.type === 'changeset'">
			<template #default="openFeature">
				<div class="fm-search-box-collapse-point">
					<h2>{{i18n.t("changeset-results.heading", { id: props.changeset.changeset.id })}}</h2>
					<dl class="fm-search-box-dl">
						<dt>{{i18n.t("changeset-results.created")}}</dt>
						<dd>{{props.changeset.changeset.created_at.toISOString().replace(".000", "")}}</dd>

						<dt>{{i18n.t("changeset-results.closed")}}</dt>
						<dd>{{props.changeset.changeset.closed_at.toISOString().replace(".000", "")}}</dd>

						<dt>{{i18n.t("changeset-results.user")}}</dt>
						<dd>
							<OsmFeatureLink type="user" :id="props.changeset.changeset.user" onlyId></OsmFeatureLink>
						</dd>

						<template v-for="(value, key) in props.changeset.changeset.tags" :key="key">
							<dt class="text-break font-monospace">{{key}}</dt>
							<dd class="text-break" v-html="renderOsmTag(key as string, value)"></dd>
						</template>
					</dl>

					<h3>{{i18n.t("changeset-results.features")}}</h3>
					<Results
						:items="featureItems"
						:active="activeFeatures"
						:unionZoom="props.unionZoom"
						:autoZoom="props.autoZoom"
						@select="(feature) => selectFeature(feature)"
						@open="(feature) => openFeature.open({ type: 'changeset', feature })"
					></Results>
				</div>
				<div class="btn-toolbar mt-2">
					<ZoomToObjectButton
						v-if="zoomDestination"
						:label="i18n.t('changeset-results.zoom-to-changeset-label')"
						size="sm"
						:destination="zoomDestination"
					></ZoomToObjectButton>

					<OsmFeatureLink
						class="btn btn-secondary btn-sm"
						type="changeset"
						:id="props.changeset.changeset.id"
						label="OpenStreetMap"
					></OsmFeatureLink>
				</div>
			</template>

			<template #openItem="openFeature">
				<ChangesetFeatureInfo
					:feature="openFeature.item.feature"
					showBackButton
					:zoom="mapContext.zoom"
					@back="openFeature.close()"
				></ChangesetFeatureInfo>
			</template>
		</SelectionCarousel>
	</div>
</template>

<style lang="scss">
	.fm-changeset-results {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.list-group-item:not(.active) {
			&.created > :first-child .fm-icon {
				color: #0c0;
			}

			&.deleted > :first-child .fm-icon {
				color: #f00;
			}

			&.modified > :first-child .fm-icon {
				color: #00f;
			}
		}
	}
</style>