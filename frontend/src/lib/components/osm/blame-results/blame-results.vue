<script setup lang="ts">
	import { useI18n } from "../../../utils/i18n";
	import { getOsmFeatureName, type OsmFeatureBlame, type OsmFeatureBlameSection } from "facilmap-utils";
	import { computed, ref, toRaw, watch } from "vue";
	import { useCarousel } from "../../../utils/carousel";
	import { injectContextRequired, requireMapContext } from "../../facil-map-context-provider/facil-map-context-provider.vue";
	import Icon from "../../ui/icon.vue";
	import vTooltip from "../../../utils/tooltip";
	import { vScrollIntoView } from "../../../utils/vue";
	import { combineZoomDestinations, flyTo, getZoomDestinationForBbox, getZoomDestinationForFeatureBlameSection } from "../../../utils/zoom";
	import ZoomToObjectButton from "../../ui/zoom-to-object-button.vue";
	import OsmFeatureLink from "../osm-feature-link.vue";
	import BlameSectionInfo from "./blame-section-info.vue";
	import EllipsisOverflow from "../../ui/ellipsis-overflow.vue";

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

	const carouselRef = ref<HTMLElement>();
	const carousel = useCarousel(carouselRef);

	const zoomDestination = computed(() => getZoomDestinationForBbox(props.blame.bbox));

	const activeSections = computed(() => props.blame.sections.filter((s) => mapContext.value.selection.some((i) => i.type === "featureBlame" && toRaw(i.section) === toRaw(s))));
	const openSection = computed(() => activeSections.value.length == 1 ? activeSections.value[0] : undefined);

	watch(openSection, () => {
		if (!openSection.value && carousel.tab !== 0) {
			carousel.setTab(0);
		}
	});

	const sectionData = computed(() => props.blame.sections.map((section, i) => ({
		key: `${i}`,
		label: (
			section.changeset.tags.comment ? i18n.t("blame-results.section-label-with-comment", { username: section.user.name, timestamp: section.timestamp, comment: section.changeset.tags.comment })
			: i18n.t("blame-results.section-label", { username: section.user.name, timestamp: section.timestamp })
		),
		section,
		zoomDestination: getZoomDestinationForFeatureBlameSection(section)
	})));

	const showZoom = computed(() => !props.autoZoom || props.unionZoom);

	const heading = computed(() => {
		const name = getOsmFeatureName(props.blame.feature.tags ?? {}, i18n.currentLanguage);
		if (props.blame.feature.type === "way") {
			if (name) {
				return i18n.t("blame-results.heading-way-named", { id: props.blame.feature.id, name });
			} else {
				return i18n.t("blame-results.heading-way-unnamed", { id: props.blame.feature.id })
			}
		} else {
			if (name) {
				return i18n.t("blame-results.heading-relation-named", { id: props.blame.feature.id, name });
			} else {
				return i18n.t("blame-results.heading-relation-unnamed", { id: props.blame.feature.id });
			}
		}
	});

	function zoomToSelectedResults(unionZoom: boolean): void {
		let dest = combineZoomDestinations(activeSections.value.map((f) => getZoomDestinationForFeatureBlameSection(f)));
		if (dest && unionZoom)
			dest = combineZoomDestinations([dest, { bounds: mapContext.value.components.map.getBounds() }]);
		if (dest)
			flyTo(mapContext.value.components.map, dest);
	}

	function handleClick(section: OsmFeatureBlameSection): void {
		selectSection(section);

		if (props.autoZoom)
			zoomToSelectedResults(props.unionZoom);
	}

	function selectSection(section: OsmFeatureBlameSection): void {
		mapContext.value.components.selectionHandler.setSelectedItems([{ type: "featureBlame", section }]);
	}

	function handleOpen(section: OsmFeatureBlameSection): void {
		selectSection(section);

		setTimeout(async () => {
			carousel.setTab(1);
		}, 0);
	}

	function closeSection(): void {
		carousel.setTab(0);
	}
</script>

<template>
	<div class="fm-blame-results">
		<div class="carousel slide fm-flex-carousel" ref="carouselRef">
			<div class="carousel-item" :class="{ active: carousel.tab === 0 }">
				<div class="fm-search-box-collapse-point">
					<h2>{{heading}}</h2>

					<ul class="list-group">
						<li
							v-for="data in sectionData"
							:key="data.key"
							class="list-group-item"
							:class="{ active: activeSections.includes(toRaw(data.section)) }"
							v-scroll-into-view="activeSections.includes(toRaw(data.section))"
						>
							<span>
								<Icon icon="square" :style="{ color: `#${data.section.user.colour}` }" />
								<a href="javascript:" class="ms-1" @click="handleClick(data.section)">
									<EllipsisOverflow :value="data.label"></EllipsisOverflow>
								</a>
							</span>

							<a
								v-if="showZoom && data.zoomDestination"
								href="javascript:"
								@click="flyTo(mapContext.components.map, data.zoomDestination)"
								v-tooltip.hover.left="i18n.t('blame-results.zoom-to-section-tooltip')"
							><Icon icon="zoom-in" :alt="i18n.t('blame-results.zoom-to-section-alt')"></Icon></a>

							<a
								href="javascript:"
								@click="handleOpen(data.section)"
								v-tooltip.left="i18n.t('blame-results.show-details-tooltip')"
							><Icon icon="arrow-right" :alt="i18n.t('blame-results.show-details-alt')"></Icon></a>
						</li>
					</ul>
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
			</div>

			<div class="carousel-item" :class="{ active: carousel.tab === 1 }">
				<BlameSectionInfo
					v-if="openSection"
					:section="openSection"
					showBackButton
					:zoom="mapContext.zoom"
					@back="closeSection()"
				></BlameSectionInfo>
			</div>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-blame-results {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.list-group-item {
			display: flex;
			align-items: center;

			> :first-child {
				flex-grow: 1;
				min-width: 0;

				> a {
					min-width: 0;
				}
			}

			> * + * {
				margin-left: 0.25rem;
			}

			span:not(.fm-ellipsis-overflow), a {
				display: inline-flex;
				align-items: center;
			}

			&:not(.active) {
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
	}
</style>