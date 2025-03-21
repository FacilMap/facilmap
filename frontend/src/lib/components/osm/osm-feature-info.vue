<script setup lang="ts">
	import { useI18n } from "../../utils/i18n";
	import { analyzeOsmRelation, calculateDistance, formatDistance, getOsmFeatureLabel, getOsmFeatureName, renderOsmTag, type AnalyzedOsmRelation, type AnalyzedOsmRelationSection, type AnalyzedOsmRelationSingleNode, type ResolvedOsmFeature } from "facilmap-utils";
	import { computed, markRaw, ref, toRaw, useId, watchEffect, type DeepReadonly } from "vue";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { getZoomDestinationForOsmFeature, getZoomDestinationForPoints } from "../../utils/zoom";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import OsmFeatureLink from "./osm-feature-link.vue";
	import type { ResultsItem } from "../ui/results.vue";
	import Results from "../ui/results.vue";
	import Icon from "../ui/icon.vue";
	import type { OsmFeatureType, OsmNode } from "osm-api";
	import Coordinates from "../ui/coordinates.vue";
	import Collapse from "../ui/collapse.vue";
	import { OsmLayer, type OsmLayerFeature } from "facilmap-leaflet";
	import type { Layer } from "leaflet";
	import { useMapLayer } from "../../utils/leaflet";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		feature: DeepReadonly<ResolvedOsmFeature | AnalyzedOsmRelation | AnalyzedOsmRelationSingleNode>;
		active?: boolean;
		visible?: boolean;
		showBackButton?: boolean;
		canOpenMember?: boolean;
		/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
		unionZoom?: boolean;
		/** When clicking or selecting a search result, zoom to it. */
		autoZoom?: boolean;
		zoom?: number;
	}>(), {
		active: true,
		visible: true,
		showBackButton: false,
		canOpenMember: false,
		unionZoom: false,
		autoZoom: false
	});

	const emit = defineEmits<{
		back: [];
		"open-member": [member: DeepReadonly<ResolvedOsmFeature>];
	}>();

	const showMembers = ref(false);
	const showNodes = ref(false);

	const zoomDestination = computed(() => getZoomDestinationForOsmFeature(props.feature));

	const analyzedRelation = computed(() => (
		props.feature.type !== "relation" ? undefined :
		"sections" in props.feature ? props.feature :
		analyzeOsmRelation(props.feature)
	));

	const scopeId = useId();
	const layer = markRaw(new OsmLayer());
	layer.on("click", (e) => {
		const layer = e.propagatedFrom as Layer | undefined;
		if (layer?._fmOsmFeature) {
			mapContext.value.components.selectionHandler.handleClickItem((
				"paths" in layer._fmOsmFeature? { type: "relationSection", section: layer._fmOsmFeature, scopeId } :
				{ type: "osm", feature: layer._fmOsmFeature, scopeId }
			), e);
		}
	});
	useMapLayer(layer);

	watchEffect((onCleanup) => {
		console.log(props.visible);
		if (props.visible) {
			if (analyzedRelation.value) {
				for (const section of analyzedRelation.value.sections) {
					layer.addFeature(toRaw(section));
				}
				onCleanup(() => {
					for (const section of analyzedRelation.value!.sections) {
						layer.removeFeature(toRaw(section));
					}
				});
			} else {
				layer.addFeature(toRaw(props.feature));
				onCleanup(() => {
					layer.removeFeature(toRaw(props.feature));
				});
			}
		}
	});

	watchEffect((onCleanup) => {
		if (props.visible && analyzedRelation.value) {
			for (const section of analyzedRelation.value.singleNodes) {
				layer.addFeature(toRaw(section));
			}
			onCleanup(() => {
				for (const section of analyzedRelation.value!.singleNodes) {
					layer.removeFeature(toRaw(section));
				}
			});
		}
	});

	watchEffect(() => {
		layer.setHighlightedFeatures(new Set([
			...(props.feature.type !== "relation" && props.active) ? [toRaw(props.feature)] : [],
			...mapContext.value.selection.flatMap((i): Array<DeepReadonly<OsmLayerFeature>> => {
				if (i.type === "osm" && i.scopeId === scopeId) {
					return [toRaw(i.feature)];
				} else if (i.type === "relationSection" && i.scopeId === scopeId) {
					return [toRaw(i.section)];
				} else {
					return [];
				}
			})
		]));
	});

	function getZoomTooltip(type: OsmFeatureType): string {
		return (
			type === "node" ? i18n.t("osm-feature-info.zoom-to-node") :
			type === "way" ? i18n.t("osm-feature-info.zoom-to-way") :
			type === "relation" ? i18n.t("osm-feature-info.zoom-to-relation") :
			""
		);
	}

	const memberItems = computed(() => props.feature.type === "relation" ? props.feature.members.map((member, i): ResultsItem<DeepReadonly<ResolvedOsmFeature>> => ({
		key: i,
		object: member.feature,
		label: getOsmFeatureLabel(member.feature.type, member.feature.id, getOsmFeatureName(member.feature.tags ?? {}, i18n.currentLanguage), member.role),
		zoomDestination: getZoomDestinationForOsmFeature(member.feature),
		zoomTooltip: getZoomTooltip(member.feature.type),
		canOpen: props.canOpenMember,
		openTooltip: i18n.t('osm-feature-info.show-details-tooltip')
	})) : []);

	const activeMembers = computed(() => mapContext.value.selection.flatMap((s) => s.type === "osm" ? [s.feature] : []));

	const activeSections = computed(() => mapContext.value.selection.flatMap((s) => s.type === "relationSection" ? [s.section] : []));

	const length = computed(() => (
		analyzedRelation.value ? analyzedRelation.value.distance :
		props.feature.type === "way" ? calculateDistance(props.feature.nodes) :
		undefined
	));

	const sectionItems = computed(() => analyzedRelation.value?.sections.map((section, i): ResultsItem<DeepReadonly<AnalyzedOsmRelationSection>> => ({
		key: i,
		object: section,
		label: i18n.t("osm-feature-info.section-label", { distance: formatDistance(section.distance) }),
		zoomDestination: getZoomDestinationForPoints(section.paths.flat()),
		zoomTooltip: i18n.t("osm-feature-info.zoom-to-section-tooltip"),
		canOpen: false
	})) ?? []);

	const nodeItems = computed(() => analyzedRelation.value?.singleNodes.map((node, i): ResultsItem<DeepReadonly<OsmNode>> => ({
		key: i,
		object: node,
		label: getOsmFeatureLabel(node.type, node.id, getOsmFeatureName(node.tags ?? {}, i18n.currentLanguage), node.role),
		zoomDestination: getZoomDestinationForOsmFeature(node),
		zoomTooltip: getZoomTooltip(node.type),
		canOpen: props.canOpenMember,
		openTooltip: i18n.t('osm-feature-info.show-details-tooltip')
	})) ?? []);

	function selectSection(section: DeepReadonly<AnalyzedOsmRelationSection>, toggle: boolean): void {
		if (toggle) {
			mapContext.value.components.selectionHandler.toggleItem({ type: "relationSection", section, scopeId });
		} else {
			mapContext.value.components.selectionHandler.setSelectedItems([{ type: "relationSection", section, scopeId }]);
		}
	}

	const heading = computed(() => getOsmFeatureLabel(props.feature.type, props.feature.id, getOsmFeatureName(props.feature.tags ?? {}, i18n.currentLanguage)));

	const renderedFeatures = ref<Array<DeepReadonly<ResolvedOsmFeature>>>([]);
	function selectFeature(feature: DeepReadonly<ResolvedOsmFeature>): void {
		mapContext.value.components.selectionHandler.setSelectedItems([{ type: "osm", feature, scopeId }]);
		renderedFeatures.value.push(feature);
		layer.addFeature(toRaw(feature));
	}

	watchEffect(() => {
		for (let i = 0; i < renderedFeatures.value.length; i++) {
			if (!mapContext.value.selection.some((s) => s.type === "osm" && s.feature === renderedFeatures.value[i])) {
				layer.removeFeature(toRaw(renderedFeatures.value[i]));
				renderedFeatures.value.splice(i--, 1);
			}
		}
	});
</script>

<template>
	<div class="fm-osm-feature-info">
		<h2 class="text-break">
			<a v-if="props.showBackButton" href="javascript:" @click="emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{heading}}
		</h2>
		<div class="fm-search-box-collapse-point">
			<dl class="fm-search-box-dl">
				<template v-if="length != null">
					<dt>{{i18n.t("osm-feature-info.total-length")}}</dt>
					<dd>{{formatDistance(length)}}</dd>
				</template>

				<template v-if="props.feature.type === 'node'">
					<dt>{{i18n.t("common.coordinates")}}</dt>
					<dd><Coordinates :point="props.feature" :zoom="props.zoom"></Coordinates></dd>
				</template>

				<template v-if="'role' in props.feature && props.feature.role">
					<dt>{{i18n.t("osm-feature-info.role")}}</dt>
					<dd>{{props.feature.role}}</dd>
				</template>

				<template v-for="(value, key) in props.feature.tags" :key="key">
					<dt class="text-break font-monospace">{{key}}</dt>
					<dd class="text-break" v-html="renderOsmTag(key as string, value)"></dd>
				</template>
			</dl>

			<template v-if="sectionItems.length > 0">
				<h3>{{i18n.t("osm-feature-info.sections")}}</h3>
				<Results
					:items="sectionItems"
					:active="activeSections"
					:unionZoom="props.unionZoom"
					:autoZoom="props.autoZoom"
					@select="(section, toggle) => selectSection(section, toggle)"
				></Results>
			</template>

			<template v-if="nodeItems.length > 0">
				<h3 class="fm-osm-feature-info-expand-heading" :class="{ expanded: showNodes }">
					<a href="javascript:" @click="showNodes = !showNodes">
						<Icon icon="chevron-right"></Icon>
						{{i18n.t("osm-feature-info.nodes")}}
					</a>
				</h3>

				<Collapse :show="showNodes">
					<Results
						:items="nodeItems"
						:active="activeMembers"
						:unionZoom="props.unionZoom"
						:autoZoom="props.autoZoom"
						@select="(feature) => selectFeature(feature)"
					></Results>
				</Collapse>
			</template>

			<template v-if="memberItems.length > 0">
				<h3 class="fm-osm-feature-info-expand-heading" :class="{ expanded: showMembers }">
					<a href="javascript:" @click="showMembers = !showMembers">
						<Icon icon="chevron-right"></Icon>
						{{i18n.t("osm-feature-info.members")}}
					</a>
				</h3>

				<Collapse :show="showMembers">
					<Results
						:items="memberItems"
						:active="activeMembers"
						:unionZoom="props.unionZoom"
						:autoZoom="props.autoZoom"
						@select="(feature) => selectFeature(feature)"
						@open="(feature) => emit('open-member', feature)"
					></Results>
				</Collapse>
			</template>
		</div>

		<div class="btn-toolbar mt-2">
			<ZoomToObjectButton
				v-if="zoomDestination"
				:label="getZoomTooltip(feature.type)"
				size="sm"
				:destination="zoomDestination"
			></ZoomToObjectButton>

			<OsmFeatureLink
				class="btn btn-secondary btn-sm"
				:type="feature.type"
				:id="feature.id"
				label="OpenStreetMap"
			></OsmFeatureLink>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-osm-feature-info {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.fm-osm-feature-info-expand-heading {
			a {
				color: inherit;
				text-decoration: none;
				display: block;
			}

			.fm-icon {
				transition: transform 0.4s;
			}

			&.expanded .fm-icon {
				transform: rotate(90deg);
			}
		}
	}
</style>