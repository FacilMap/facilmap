<script setup lang="ts">
	import { makeTypeFilter, markdownBlock, normalizeMapName } from "facilmap-utils";
	import { getLegendItems, type LegendItem, type LegendType } from "./legend-utils";
	import { computed } from "vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";
	import LegendItems from "./legend-items.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const client = requireClientContext(context);
	const i18n = useI18n();

	const props = defineProps<{
		noPopover?: boolean;
	}>();

	const legend1 = computed(() => {
		return client.value.mapData?.legend1?.trim() || "";
	});

	const legend2 = computed(() => {
		return client.value.mapData?.legend2?.trim() || "";
	});

	const legendItems = computed(() => {
		return getLegendItems(context);
	});

	const legend1Html = computed(() => {
		return legend1.value ? markdownBlock(legend1.value, true) : "";
	});

	const legend2Html = computed(() => {
		return legend2.value ? markdownBlock(legend2.value, true) : "";
	});

	function toggleFilter(typeInfo: LegendType, item?: LegendItem): void {
		let filters: Parameters<typeof makeTypeFilter>[2] = { };
		if(!item || !item.field) // We are toggling the visibility of one whole type
			filters = !typeInfo.filtered;
		else {
			for (const it of typeInfo.items) {
				if(it.field) {
					if(!filters[it.field])
						filters[it.field] = { };

					if(!typeInfo.filtered || it.field == item.field)
						filters[it.field][it.value] = (it.filtered == (it != item));
					else // If the whole type is filtered, we have to enable the filters of the other fields, otherwise the type will still be completely filtered
						filters[it.field][it.value] = false;
				}
			}
		}

		mapContext.value.components.map.setFmFilter(makeTypeFilter(mapContext.value.components.map.fmFilter, typeInfo.typeId, filters));
	}

	const isEmpty = computed(() => legendItems.value.length === 0 && !legend1.value && !legend2.value);

	defineExpose({
		isEmpty
	});
</script>

<template>
	<div class="fm-legend-map-content" v-if="!isEmpty">
		<h3 v-if="client.mapData">{{normalizeMapName(client.mapData.name)}}</h3>

		<div v-if="legend1" class="fm-legend1">
			<div v-html="legend1Html"></div>
			<hr v-if="legendItems.length > 0 || legend2" />
		</div>

		<template v-for="(type, idx) in legendItems" :key="type.key">
			<hr v-if="idx > 0 && (type.items.length > 1 || legendItems[idx - 1].items.length > 1)">
			<LegendItems
				:type="type.type"
				:items="type.items"
				:noPopover="props.noPopover"
				:popoverText="i18n.t('legend-map-content.click-explanation')"
				@click="(e, item) => toggleFilter(type, item)"
			></LegendItems>
		</template>

		<div v-if="legend2" class="fm-legend2">
			<hr v-if="legendItems.length > 0" />
			<div v-html="legend2Html"></div>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-legend-map-content {
		:is(.fm-legend1,.fm-legend2) > div > *:first-child {
			margin-top: 0;
		}

		:is(.fm-legend1,.fm-legend2) > div > *:last-child {
			margin-bottom: 0;
		}
	}
</style>