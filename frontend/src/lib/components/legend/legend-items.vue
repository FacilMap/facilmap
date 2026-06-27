<script setup lang="ts">
	import type { Type } from "facilmap-types";
	import { createLinePlaceholderHtml } from "../../utils/ui";
	import { getIconHtml, getMarkerHtml } from "facilmap-leaflet";
	import type { LegendItem } from "./legend-utils";
	import { computed, getCurrentInstance, reactive, ref } from "vue";
	import Popover from "../ui/popover.vue";
	import { mapRef, vHtmlAsync } from "../../utils/vue";
	import { markdownInline } from "facilmap-utils";
	import Icon from "../ui/icon.vue";
	import type { Tooltip } from "bootstrap";

	const props = defineProps<{
		type: Type['type'];
		items: LegendItem[];
		noPopover?: boolean;
		popoverText?: string;
		heading?: string;
		infoPlacement?: Tooltip.PopoverPlacement;
	}>();

	const emit = defineEmits<{
		click: [MouseEvent, LegendItem];
	}>();

	const instance = getCurrentInstance();
	const hasClickListener = computed(() => !!instance?.vnode.props?.onClick);

	const activePopoverKey = ref<string>();
	const itemIconRefs = reactive(new Map<string, HTMLElement>());

	const infoButtonRef = ref<HTMLElement>();
	const showInfo = ref(false);

	const offerInfo = computed(() => props.items.some((it) => it.description));

	async function makeIcon(type: Type['type'], item: LegendItem, height = 15): Promise<string> {
		if(type == "line")
			return createLinePlaceholderHtml(item.colour || "rainbow", item.width || 5, 50, item.stroke ?? "");
		else if (item.colour || item.shape != null)
			return await getMarkerHtml(item.colour || "rainbow", height, item.icon, item.shape);
		else
			return await getIconHtml("#000000", height, item.icon);
	}

	function togglePopover(itemKey: string, show: boolean) {
		const isShown = activePopoverKey.value === itemKey;
		if (isShown !== show) {
			activePopoverKey.value = show ? itemKey : undefined;
		}
	}
</script>

<template>
	<h3 v-if="props.heading">
		{{props.heading}}
		<a v-if="offerInfo" href="javascript:" ref="infoButtonRef" @click="showInfo = !showInfo"><Icon icon="info-sign"></Icon></a>
	</h3>

	<dl class="fm-legend-items" :class="{ hasClickListener }">
		<template v-for="(item, idx) in props.items" :key="item.key">
			<dt
				:class="[ 'fm-legend-icon', 'fm-' + props.type, { filtered: item.filtered, first: (item.first && idx !== 0), bright: item.bright, main: item.main } ]"
				@click="emit('click', $event, item)"
				v-html-async="makeIcon(type, item)"
				@mouseenter="togglePopover(item.key, true)"
				@mouseleave="togglePopover(item.key, false)"
				:ref="mapRef(itemIconRefs, item.key)"
			></dt>
			<dd
				class="text-break"
				:class="[ 'fm-' + props.type, { filtered: item.filtered, first: (item.first && idx !== 0), bright: item.bright, main: item.main } ]"
				@click="emit('click', $event, item)"
				:style="item.strikethrough ? {'text-decoration': 'line-through'} : {}"
				@mouseenter="togglePopover(item.key, true)"
				@mouseleave="togglePopover(item.key, false)"
			>{{item.label}}</dd>
		</template>
	</dl>

	<div v-if="!props.noPopover" class="fm-legend-popover-wrapper">
		<template v-for="item in props.items" :key="item.key">
			<Popover
				:element="itemIconRefs.get(item.key)"
				placement="left"
				class="fm-legend-popover"
				:show="activePopoverKey === item.key"
				@update:show="togglePopover(item.key, $event)"
			>
				<div
					:class="[
						'fm-legend-icon',
						`fm-${props.type}`,
						{
							filtered: item.filtered,
							bright: item.bright
						}
					]"
					v-html-async="makeIcon(type, item, 40)"
				></div>
				<div>
					<h3 class="text-break" :style="item.strikethrough ? {'text-decoration': 'line-through'} : {}">
						<span >{{item.label}}</span>
					</h3>
					<template v-if="item.description">
						<p class="description" v-html="markdownInline(item.description, true)"></p>
					</template>
					<template v-if="props.popoverText">
						<p class="popoverText">
							{{props.popoverText}}
						</p>
					</template>
				</div>
			</Popover>
		</template>
	</div>

	<Popover
		v-if="offerInfo"
		:element="infoButtonRef"
		:placement="props.infoPlacement"
		class="fm-legend-info-popover"
		v-model:show="showInfo"
	>
		<h3>{{props.heading}}</h3>

		<template v-for="item in props.items" :key="item.key">
			<h4>
				<span v-html-async="makeIcon(type, item)"></span>
				<span>{{item.label}}</span>
			</h4>
			<template v-if="item.description">
				<p class="description" v-html="markdownInline(item.description, true)"></p>
			</template>
		</template>
	</Popover>
</template>

<style lang="scss">
	.fm-legend-items {
		// In narrow mode, SearchBox sets some styles for dl. We need to take care of overriding them here.

		display: grid;
		grid-template-columns: calc(11px + 1ex) calc(50px - 11px) 1fr;
		margin: 0px;
		align-items: center;

		> * {
			margin: 0;
		}

		&.hasClickListener > * {
			cursor: pointer;
		}

		dt, dd {
			display: inline-flex;
			align-items: center;
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

		.main {
			font-size: 1.1em;
			font-weight: bold;
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

			div + div {
				margin: 0 0 0 0.5em;
			}

			h3 {
				font-size: 1rem;
			}

			h3:last-child, p:last-child {
				margin-bottom: 0;
			}

			p.popoverText {
				font-style: italic;
				font-size: 0.875em;
			}
		}
	}

	.fm-legend-info-popover.fm-legend-info-popover.fm-legend-info-popover.fm-legend-info-popover {
		width: max-content;

		p:not(:last-child) {
			margin-bottom: 0.75rem;
		}

		h3 {
			margin-bottom: 1rem;
		}

		h4 {
			font-size: 1.2em;
			gap: 0.5rem;

			&, span {
				display: flex;
				align-items: center;
			}
		}
	}

	.fm-legend-icon {
		color-scheme: only light;
	}
</style>