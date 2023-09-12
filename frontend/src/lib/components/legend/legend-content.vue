<script setup lang="ts">
	import "./legend-content.scss";
	import WithRender from "./legend-content.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { getMarkerHtml, getSymbolHtml } from "facilmap-leaflet";
	import { MapComponents } from "../leaflet-map/leaflet-map";
	import { InjectMapComponents } from "../../utils/decorators";
	import { makeTypeFilter, markdownBlock } from "facilmap-utils";
	import { LegendItem, LegendType } from "./legend-utils";
	import { createLinePlaceholderHtml } from "../../utils/ui";

	@WithRender
	@Component({})
	export default class LegendContent extends Vue {

		@InjectMapComponents() mapComponents!: MapComponents;

		@Prop({ type: String }) legend1?: string;
		@Prop({ type: String }) legend2?: string;
		@Prop({ type: Array, required: true }) items!: LegendItem[];
		@Prop({ type: Boolean, default: false }) noPopover!: boolean;

		popover: {
			target: HTMLElement,
			type: LegendType,
			item: LegendItem
		} | null = null;
		popoverTimeout: ReturnType<typeof setTimeout> | null = null;

		get legend1Html(): string {
			return this.legend1 ? markdownBlock(this.legend1) : "";
		}

		get legend2Html(): string {
			return this.legend2 ? markdownBlock(this.legend2) : "";
		}

		toggleFilter(typeInfo: LegendType, item: LegendItem): void {
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

			this.mapComponents.map.setFmFilter(makeTypeFilter(this.mapComponents.map.fmFilter, typeInfo.typeId, filters));
		}

		makeSymbol(typeInfo: LegendType, item: LegendItem, height = 15): string {
			if(typeInfo.type == "line")
				return createLinePlaceholderHtml(item.colour || "rainbow", item.width || 5, 50);
			else if (item.colour || item.shape != null)
				return getMarkerHtml(item.colour || typeInfo.defaultColour || "rainbow", height, item.symbol, item.shape ?? typeInfo.defaultShape);
			else
				return getSymbolHtml("#000000", height, item.symbol);
		}

		handleMouseEnter(target: HTMLElement, type: LegendType, item: LegendItem): void {
			if (this.noPopover)
				return;

			if (this.popoverTimeout != null)
				clearTimeout(this.popoverTimeout);

			if (this.popover && this.popover.item !== item)
				this.popover = null;

			this.$nextTick(() => {
				this.popover = { target, type, item };
			});
		}

		handleMouseLeave(): void {
			this.popoverTimeout = setTimeout(() => {
				this.popover = null;
			}, 0);
		}

	}
</script>

<template>
	<div class="fm-legend-content">
		<div v-if="legend1" class="fm-legend1">
			<div v-html="legend1Html"></div>
			<hr v-if="items.length > 0 || legend2" />
		</div>

		<template v-for="(type, idx) in items">
			<hr v-if="idx > 0">
			<h3 @click="toggleFilter(type)" :class="{ filtered: type.filtered }">{{type.name}}</h3>
			<dl>
				<template v-for="item in type.items">
					<dt
						:class="[ 'fm-legend-symbol', 'fm-' + type.type, { filtered: item.filtered, first: item.first, bright: item.bright } ]"
						@click="toggleFilter(type, item)"
						v-html="makeSymbol(type, item)"
						@mouseenter="handleMouseEnter($event.target, type, item)"
						@mouseleave="handleMouseLeave()"
					></dt>
					<dd
						:class="[ 'fm-' + type.type, { filtered: item.filtered, first: item.first, bright: item.bright } ]"
						@click="toggleFilter(type, item)"
						:style="item.strikethrough ? {'text-decoration': 'line-through'} : {}"
						@mouseenter="handleMouseEnter($event.target.previousElementSibling, type, item)"
						@mouseleave="handleMouseLeave()"
					>{{item.label}}</dd>
				</template>
			</dl>
		</template>

		<div v-if="legend2" class="fm-legend2">
			<hr v-if="items.length > 0" />
			<div v-html="legend2Html"></div>
		</div>

		<b-popover v-if="popover" :target="popover.target" placement="left" show custom-class="fm-legend-popover">
			<div :class="[ 'fm-legend-symbol', 'fm-' + popover.type.type, { filtered: popover.item.filtered, bright: popover.item.bright } ]" v-html="makeSymbol(popover.type, popover.item, 40)"></div>
			<p>
				<span :style="popover.item.strikethrough ? {'text-decoration': 'line-through'} : {}">{{popover.item.label}}</span>
				<br>
				<small><em>Click to show/hide objects of this type.</em></small>
			</p>
		</b-popover>
	</div>
</template>

<style lang="scss">
	.fm-legend-content {

		font-size: 12px;

		.fm-legend1 > div > *:first-child {
			margin-top: 0;
		}

		.fm-legend2 > div > *:last-child {
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

		&#{&}#{&} dl {
			display: block; // Override display: grid from search-box styles
			margin-bottom: 0px;
		}

		dt {
			margin: 0;
			width: auto;
			padding-right: 1ex;
			display: inline-block;
			cursor: pointer;
		}

		dt.fm-marker {
			width: 16px;
			text-align: center;
		}

		dt:after {
			content: none;
		}

		dd {
			line-height: 1.3em;
			width: auto;
			display: inline;
			vertical-align: middle;
			cursor: pointer;
		}

		dd:after {
			content: "\a";
			white-space: pre;
		}

		.first:not(:first-child) {
			margin-top: 6px;
		}

		dl:after {
			content: none;
		}

		.filtered {
			opacity: 0.5;
		}
	}

	.fm-legend-popover .popover-body {
		display: flex;
		align-items: center;

		p {
			margin: 0 0 0 0.5em;
		}
	}

	.fm-legend-symbol {
		&.fm-line > svg {
			border-radius: 1000px;
		}

		&.fm-line.bright > svg {
			box-shadow: 0 0 2px #000;
		}
	}
</style>