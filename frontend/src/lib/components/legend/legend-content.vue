<script setup lang="ts">
	import { computed, ref, type ComponentInstance } from "vue";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import LegendMapContent from "./legend-map-content.vue";
	import LegendItems from "./legend-items.vue";
	import { useI18n } from "../../utils/i18n";
	import type { Tooltip } from "bootstrap";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const props = defineProps<{
		noPopover?: boolean;
		infoPlacement?: Tooltip.PopoverPlacement;
	}>();

	const legendMapContentRef = ref<ComponentInstance<typeof LegendMapContent>>();

	const layers = computed(() => (["OPTM", "Hike", "Bike", "Toll", "CycR", "Cobl"] as const).filter((l) => mapContext.value.layers.overlays.includes(l)));

	const isEmpty = computed(() => layers.value.length === 0 && (legendMapContentRef.value?.isEmpty ?? true));

	defineExpose({
		isEmpty
	});
</script>

<template>
	<div class="fm-legend-content">
		<template v-for="(layer, idx) in layers" :key="layer">
			<hr v-if="idx > 0" />

			<template v-if="layer === 'OPTM'">
				<LegendItems
					:heading="i18n.t('legend-content.public-transportation')"
					type="line"
					:items="[
						{
							key: 'train',
							colour: '#000',
							label: i18n.t('legend-content.public-transportation-train-label')
						},
						{
							key: 'sbahn',
							colour: '#0c0',
							label: i18n.t('legend-content.public-transportation-sbahn-label')
						},
						{
							key: 'metro',
							colour: '#00f',
							label: i18n.t('legend-content.public-transportation-metro-label')
						},
						{
							key: 'tram',
							colour: '#d0f',
							label: i18n.t('legend-content.public-transportation-tram-label')
						},
						{
							key: 'bus',
							colour: '#f00',
							label: i18n.t('legend-content.public-transportation-bus-label')
						},
						{
							key: 'bus-alternate',
							colour: '#f00',
							stroke: 'dashed',
							label: i18n.t('legend-content.public-transportation-bus-alternate-label')
						},
						{
							key: 'trolleybus',
							colour: '#b22',
							label: i18n.t('legend-content.public-transportation-trolleybus-label')
						},
						{
							key: 'ferry',
							colour: '#ff7fbf',
							label: i18n.t('legend-content.public-transportation-ferry-label')
						},
						{
							key: 'aerialway',
							colour: '#642',
							label: i18n.t('legend-content.public-transportation-aerialway-label')
						},
					]"
					:noPopover="props.noPopover"
					:infoPlacement="props.infoPlacement"
				></LegendItems>
			</template>

			<template v-else-if="layer === 'Hike'">
				<LegendItems
					:heading="i18n.t('legend-content.hiking-paths')"
					type="line"
					:items="[
						{
							key: 'international',
							colour: '#b20303',
							label: i18n.t('legend-content.hiking-paths-international-label')
						},
						{
							key: 'national',
							colour: '#152eec',
							label: i18n.t('legend-content.hiking-paths-national-label')
						},
						{
							key: 'regional',
							colour: '#ffa304',
							label: i18n.t('legend-content.hiking-paths-regional-label')
						},
						{
							key: 'local',
							colour: '#7d31c6',
							label: i18n.t('legend-content.hiking-paths-local-label')
						}
					]"
					:noPopover="props.noPopover"
					:infoPlacement="props.infoPlacement"
				></LegendItems>
			</template>

			<template v-else-if="layer === 'Bike'">
				<LegendItems
					:heading="i18n.t('legend-content.bicycle-routes')"
					type="line"
					:items="[
						{
							key: 'international',
							colour: '#b20303',
							label: i18n.t('legend-content.bicycle-routes-international-label')
						},
						{
							key: 'national',
							colour: '#152eec',
							label: i18n.t('legend-content.bicycle-routes-national-label')
						},
						{
							key: 'regional',
							colour: '#ffa304',
							label: i18n.t('legend-content.bicycle-routes-regional-label')
						},
						{
							key: 'local',
							colour: '#7d31c6',
							label: i18n.t('legend-content.bicycle-routes-local-label')
						}
					]"
					:noPopover="props.noPopover"
					:infoPlacement="props.infoPlacement"
				></LegendItems>
			</template>

			<template v-else-if="layer === 'Toll'">
				<LegendItems
					:heading="i18n.t('legend-content.tolls')"
					type="line"
					:items="[
						{
							key: 'tolls',
							colour: '#800080',
							label: i18n.t('legend-content.tolls-tolls-label')
						}
					]"
					:noPopover="props.noPopover"
					:infoPlacement="props.infoPlacement"
				></LegendItems>
			</template>

			<template v-else-if="layer === 'CycR'">
				<LegendItems
					:heading="i18n.t('legend-content.cycling-restrictions')"
					type="line"
					:items="[
						{
							key: 'restricted',
							colour: '#D32F2F',
							label: i18n.t('legend-content.cycling-restrictions-restricted-label'),
							description: i18n.t('legend-content.cycling-restrictions-restricted-description')
						},
						{
							key: 'sidepath',
							colour: '#FF6600',
							label: i18n.t('legend-content.cycling-restrictions-sidepath-label'),
							description: i18n.t('legend-content.cycling-restrictions-sidepath-description')
						},
						{
							key: 'motorway',
							colour: '#4B0082',
							label: i18n.t('legend-content.cycling-restrictions-motorway-label'),
							description: i18n.t('legend-content.cycling-restrictions-motorway-description')
						},
						{
							key: 'motorroad',
							colour: '#8B008B',
							label: i18n.t('legend-content.cycling-restrictions-motorroad-label'),
							description: i18n.t('legend-content.cycling-restrictions-motorroad-description')
						},
						{
							key: 'pedestrian',
							colour: '#00695C',
							label: i18n.t('legend-content.cycling-restrictions-pedestrian-label'),
							description: i18n.t('legend-content.cycling-restrictions-pedestrian-description')
						}
					]"
					:noPopover="props.noPopover"
					:infoPlacement="props.infoPlacement"
				></LegendItems>
			</template>

			<template v-else-if="layer === 'Cobl'">
				<LegendItems
					:heading="i18n.t('legend-content.cobblestone')"
					type="line"
					:items="[
						{
							key: 'cobblestone',
							colour: '#A45A52',
							label: i18n.t('legend-content.cobblestone-cobblestone-label')
						}
					]"
					:noPopover="props.noPopover"
					:infoPlacement="props.infoPlacement"
				></LegendItems>
			</template>
		</template>

		<hr v-if="layers.length > 0 && legendMapContentRef && !legendMapContentRef.isEmpty" />

		<LegendMapContent
			:noPopover="props.noPopover"
			ref="legendMapContentRef"
		></LegendMapContent>
	</div>
</template>

<style lang="scss">
	// We need a high specificity, as .fm-search-box overrides some of the hr styles

	.fm-legend-content.fm-legend-content.fm-legend-content {
		font-size: 12px;

		h3 {
			font-size: 1.4em;
			margin: 0 0 0.5rem 0;
			font-weight: bold;
		}

		hr {
			margin: 10px -8px;
		}

		> hr {
			opacity: 0.75;
			margin: 1rem -8px;
		}
	}
</style>