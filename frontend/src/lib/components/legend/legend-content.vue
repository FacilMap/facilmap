<script setup lang="ts">
	import { computed, ref, type ComponentInstance } from "vue";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import LegendMapContent from "./legend-map-content.vue";
	import LegendItems from "./legend-items.vue";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const props = defineProps<{
		noPopover?: boolean;
	}>();

	const legendMapContentRef = ref<ComponentInstance<typeof LegendMapContent>>();

	const hasTolls = computed(() => mapContext.value.layers.overlays.includes("Toll"));
	const hasCyclingRestrictions = computed(() => mapContext.value.layers.overlays.includes("CycR"));
	const hasCobblestone = computed(() => mapContext.value.layers.overlays.includes("Cobl"));

	const isEmpty = computed(() => !hasTolls.value && !hasCyclingRestrictions.value && !hasCobblestone.value && (legendMapContentRef.value?.isEmpty ?? true));

	defineExpose({
		isEmpty
	});
</script>

<template>
	<div class="fm-legend-content">
		<template v-if="hasTolls">
			<h3>{{i18n.t("legend-content.tolls")}}</h3>
			<LegendItems
				type="line"
				:items="[
					{
						key: 'tolls',
						colour: '#800080',
						label: i18n.t('legend-content.tolls-tolls-label')
					}
				]"
				:noPopover="props.noPopover"
			></LegendItems>

			<hr />
		</template>

		<template v-if="hasCyclingRestrictions">
			<h3>{{i18n.t("legend-content.cycling-restrictions")}}</h3>
			<LegendItems
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
			></LegendItems>

			<hr />
		</template>

		<template v-if="hasCobblestone">
			<h3>{{i18n.t("legend-content.cobblestone")}}</h3>
			<LegendItems
				type="line"
				:items="[
					{
						key: 'cobblestone',
						colour: '#A45A52',
						label: i18n.t('legend-content.cobblestone-cobblestone-label')
					}
				]"
				:noPopover="props.noPopover"
			></LegendItems>

			<hr />
		</template>

		<LegendMapContent
			:noPopover="props.noPopover"
			ref="legendMapContentRef"
		></LegendMapContent>
	</div>
</template>

<style lang="scss">
	.fm-legend-content {
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
		}

		> hr:last-child {
			display: none;
		}
	}
</style>