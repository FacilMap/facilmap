<script setup lang="ts">
	import "./legend.scss";
	import WithRender from "./legend.vue";
	import Vue from "vue";
	import { Component, Ref } from "vue-property-decorator";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import { round } from "facilmap-utils";
	import $ from "jquery";
	import LegendContent from "./legend-content";
	import { getLegendItems, LegendType } from "./legend-utils";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import { Context } from "../facilmap/facilmap";
	import { Portal } from "portal-vue";

	@WithRender
	@Component({
		components: { LegendContent, Portal }
	})
	export default class Legend extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();
		const mapContext = injectMapContextRequired();
		const mapComponents = injectMapComponentsRequired();

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

</script>

<template>
	<div class="fm-legend" v-if="legendItems.length > 0 || legend1 || legend2">
		<b-card v-if="!context.isNarrow" class="fm-legend-absolute" :style="{ transform: `scale(${scale})` }" ref="absoluteContainer">
			<LegendContent :items="legendItems" :legend1="legend1" :legend2="legend2"></LegendContent>
		</b-card>
		<portal v-else to="fm-search-box">
			<b-tab title="Legend">
				<LegendContent :items="legendItems" :legend1="legend1" :legend2="legend2" no-popover></LegendContent>
			</b-tab>
		</portal>
	</div>
</template>

<style lang="scss">
	.fm-legend-absolute.fm-legend-absolute {
		position: absolute;
		right: 10px;
		bottom: 25px;
		z-index: 800;
		transform-origin: bottom right;
		opacity: .7;
		transition: opacity .7s;

		&:hover {
			opacity: 1;
		}
	}
</style>