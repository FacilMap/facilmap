<script setup lang="ts">
	import { getMarkerHtml, getSymbolHtml } from "facilmap-leaflet";
	import { makeTypeFilter, markdownBlock } from "facilmap-utils";
	import type { LegendItem, LegendType } from "./legend-utils";
	import { createLinePlaceholderHtml } from "../../utils/ui";
	import Popover from "../ui/popover.vue";
	import { computed, reactive, ref } from "vue";
	import { mapRef, vHtmlAsync } from "../../utils/vue";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);

	const props = withDefaults(defineProps<{
		legend1?: string;
		legend2?: string;
		items: LegendType[];
		noPopover?: boolean;
	}>(), {
		noPopover: false
	});

	const activePopoverKey = ref<string>();
	const itemIconRefs = reactive(new Map<string, HTMLElement>());

	const legend1Html = computed(() => {
		return props.legend1 ? markdownBlock(props.legend1) : "";
	});

	const legend2Html = computed(() => {
		return props.legend2 ? markdownBlock(props.legend2) : "";
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

	async function makeSymbol(typeInfo: LegendType, item: LegendItem, height = 15): Promise<string> {
		if(typeInfo.type == "line")
			return createLinePlaceholderHtml(item.colour || "rainbow", item.width || 5, 50, item.stroke ?? "");
		else if (item.colour || item.shape != null)
			return await getMarkerHtml(item.colour || "rainbow", height, item.symbol, item.shape);
		else
			return await getSymbolHtml("#000000", height, item.symbol);
	}

	function togglePopover(itemKey: string, show: boolean) {
		const isShown = activePopoverKey.value === itemKey;
		if (isShown !== show) {
			activePopoverKey.value = show ? itemKey : undefined;
		}
	}
</script>

<template>
	<div class="fm-legend-content">
		<div v-if="legend1" class="fm-legend1">
			<div v-html="legend1Html"></div>
			<hr v-if="items.length > 0 || legend2" />
		</div>

		<template v-for="(type, idx) in items" :key="type.key">
			<hr v-if="idx > 0">
			<h3 @click="toggleFilter(type)" :class="{ filtered: type.filtered }">{{type.name}}</h3>
			<dl>
				<template v-for="(item, idx) in type.items" :key="item.key">
					<dt
						:class="[ 'fm-legend-symbol', 'fm-' + type.type, { filtered: item.filtered, first: (item.first && idx !== 0), bright: item.bright } ]"
						@click="toggleFilter(type, item)"
						v-html-async="makeSymbol(type, item)"
						@mouseenter="togglePopover(item.key, true)"
						@mouseleave="togglePopover(item.key, false)"
						:ref="mapRef(itemIconRefs, item.key)"
					></dt>
					<dd
						class="text-break"
						:class="[ 'fm-' + type.type, { filtered: item.filtered, first: (item.first && idx !== 0), bright: item.bright } ]"
						@click="toggleFilter(type, item)"
						:style="item.strikethrough ? {'text-decoration': 'line-through'} : {}"
						@mouseenter="togglePopover(item.key, true)"
						@mouseleave="togglePopover(item.key, false)"
					>{{item.label}}</dd>
				</template>
			</dl>
			<div v-if="!props.noPopover" class="fm-legend-popover-wrapper">
				<template v-for="item in type.items" :key="item.key">
					<Popover
						:element="itemIconRefs.get(item.key)"
						placement="left"
						class="fm-legend-popover"
						:show="activePopoverKey === item.key"
						@update:show="togglePopover(item.key, $event)"
					>
						<div
							:class="[
								'fm-legend-symbol',
								`fm-${type.type}`,
								{
									filtered: item.filtered,
									bright: item.bright
								}
							]"
							v-html-async="makeSymbol(type, item, 40)"
						></div>
						<p>
							<span class="text-break" :style="item.strikethrough ? {'text-decoration': 'line-through'} : {}">{{item.label}}</span>
							<br>
							<small><em>Click to show/hide objects of this type.</em></small>
						</p>
					</Popover>
				</template>
			</div>
		</template>

		<div v-if="legend2" class="fm-legend2">
			<hr v-if="items.length > 0" />
			<div v-html="legend2Html"></div>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-legend-content {
		font-size: 12px;

		:is(.fm-legend1,.fm-legend2) > div > *:first-child {
			margin-top: 0;

		}

		:is(.fm-legend1,.fm-legend2) > div > *:last-child {
			margin-bottom: 0;
		}

		h3 {
			font-size: 1.1em;
			margin: 0 0 5px 0;
			padding: 0;
			font-weight: bold;
			cursor: pointer;
		}

		hr {
			margin: 10px -8px;
		}

		dl {
			// In narrow mode, SearchBox sets some styles for dl. We need to take care of overriding them here.

			display: grid;
			grid-template-columns: calc(11px + 1ex) calc(50px - 11px) 1fr;
			margin: 0px;
			align-items: center;

			> * {
				margin: 0;
				cursor: pointer;
			}

			dt.fm-marker {
				grid-column: 1 / 2;
			}

			dd.fm-marker {
				grid-column: 2 / 4;
			}

			dt.fm-line {
				grid-column: 1 / 3;
			}

			dd.fm-line {
				grid-column: 3 / 4;
			}

			dt:after,dl:after {
				content: none;
			}

			.first {
				margin-top: 6px;
			}
		}

		.filtered {
			opacity: 0.5;
		}
	}

	.fm-legend-popover {
		max-width: none;

		.popover-body {
			display: flex;
			align-items: center;
			width: max-content;
			max-width: 100%;

			p {
				margin: 0 0 0 0.5em;
			}
		}
	}
</style>