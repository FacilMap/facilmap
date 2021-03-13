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
		else if (item.colour || item.shape)
			return getMarkerHtml(item.colour || typeInfo.defaultColour || "rainbow", height, item.symbol, item.shape || typeInfo.defaultShape);
		else
			return getSymbolHtml("000000", height, item.symbol);
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
