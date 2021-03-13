import "./legend.scss";
import WithRender from "./legend.vue";
import Vue from "vue";
import { Component, Ref } from "vue-property-decorator";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { round } from "facilmap-utils";
import $ from "jquery";
import context from "../context";
import LegendContent from "./legend-content";
import Client from "facilmap-client";
import { getLegendItems, LegendType } from "./legend-utils";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";

@WithRender
@Component({
	components: { LegendContent }
})
export default class Legend extends Vue {

	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Ref() absoluteContainer?: HTMLElement;

	scale = 1;

	mounted(): void {
		$(window).on("resize", this.updateMaxScale);
		this.updateMaxScale();
	}

	updated(): void {
		this.updateMaxScale();
	}

	beforeDestroy(): void {
		$(window).off("resize", this.updateMaxScale);
	}

	get isNarrow(): boolean {
		return context.isNarrow;
	}

	updateMaxScale(): void {
		if (this.absoluteContainer) {
			const mapContainer = this.mapComponents.map.getContainer();
			const maxHeight = mapContainer.offsetHeight - 100;
			const maxWidth = mapContainer.offsetWidth - 20;

			const currentHeight = this.absoluteContainer.offsetHeight;
			const currentWidth = this.absoluteContainer.offsetWidth;

			const newScale = round(Math.min(1, maxHeight / currentHeight, maxWidth / currentWidth), 4);
			if (isFinite(newScale) && newScale != this.scale)
				this.scale = newScale;
		}
	}

	get legend1(): string {
		return this.client.padData?.legend1?.trim() || "";
	}

	get legend2(): string {
		return this.client.padData?.legend2?.trim() || "";
	}

	get legendItems(): LegendType[] {
		return getLegendItems(this.client, this.mapContext);
	}

}
