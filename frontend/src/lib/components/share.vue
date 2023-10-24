<script setup lang="ts">
	import Component from "vue-class-component";
	import Vue from "vue";
	import WithRender from "./share.vue";
	import { Prop } from "vue-property-decorator";
	import "./share.scss";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import { getLayers } from "facilmap-leaflet";
	import { Context } from "../facilmap/facilmap";
	import copyToClipboard from "copy-to-clipboard";
	import { getLegendItems } from "../legend/legend-utils";
	import { Writable } from "facilmap-types";
	import { quoteHtml } from "facilmap-utils";

	@WithRender
	@Component({
		components: { }
	})
	export default class Share extends Vue {

		@Prop({ type: String, required: true }) id!: string;

		const context = injectContextRequired();
		const client = injectClientRequired();
		const mapContext = injectMapContextRequired();
		const mapComponents = injectMapComponentsRequired();

		includeMapView = true;
		showToolbox = true;
		showSearch = true;
		showLegend = true;
		padIdType: Writable = 2;

		initialize(): void {
			this.includeMapView = true;
			this.showToolbox = true;
			this.showSearch = true;
			this.showLegend = true;
			this.padIdType = this.client.writable ?? 2;
		}

		get layers(): string {
			const { baseLayers, overlays } = getLayers(this.mapComponents.map);
			return [
				baseLayers[this.mapContext.layers.baseLayer]?.options.fmName || this.mapContext.layers.baseLayer,
				...this.mapContext.layers.overlays.map((key) => overlays[key].options.fmName || key)
			].join(", ");
		}

		get hasLegend(): boolean {
			return !!this.client.padData && getLegendItems(this.client, this.mapContext).length > 0;
		}

		get padIdTypes(): Array<{ value: Writable; text: string }> {
			return [
				{ value: 2, text: 'Admin' },
				{ value: 1, text: 'Writable' },
				{ value: 0, text: 'Read-only' }
			].filter((option) => this.client.writable != null && option.value <= this.client.writable);
		}

		get url(): string {
			const params = new URLSearchParams();
			if (!this.showToolbox)
				params.set("toolbox", "false");
			if (!this.showSearch)
				params.set("search", "false");
			if (!this.showLegend)
				params.set("legend", "false");
			const paramsStr = params.toString();

			return this.context.baseUrl
				+ (this.client.padData ? encodeURIComponent((this.padIdType == 2 && this.client.padData.adminId) || (this.padIdType == 1 && this.client.padData.writeId) || this.client.padData.id) : '')
				+ (paramsStr ? `?${paramsStr}` : '')
				+ (this.includeMapView && this.mapContext.hash ? `#${this.mapContext.hash}` : '');
		}

		get embedCode(): string {
			return `<iframe style="height:500px; width:100%; border:none;" src="${quoteHtml(this.url)}"></iframe>`;
		}

		copyUrl(): void {
			copyToClipboard(this.url);
			this.$bvToast.toast("The map link was copied to the clipboard.", { variant: "success", title: "Map link copied" });
		}

		copyEmbedCode(): void {
			copyToClipboard(this.embedCode);
			this.$bvToast.toast("The code to embed FacilMap was copied to the clipboard.", { variant: "success", title: "Embed code copied" });
		}

	}

</script>

<template>
	<b-modal :id="id" title="Share" ok-only ok-title="Close" size="lg" dialog-class="fm-share" @show="initialize">
		<b-form-group label="Settings" label-cols-sm="3" label-class="pt-0">
			<b-form-checkbox v-model="includeMapView" :disabled="!client.padData">
				Include current map view (centre: <code>{{mapContext.center.lat | round(5)}},{{mapContext.center.lng | round(5)}}</code>; zoom level: <code>{{mapContext.zoom}}</code>; layer(s): {{layers}}<template v-if="mapContext.overpassIsCustom ? !!mapContext.overpassCustom : mapContext.overpassPresets.length > 0">; POIs: <code v-if="mapContext.overpassIsCustom">{{mapContext.overpassCustom}}</code><template v-else>{{mapContext.overpassPresets.map((p) => p.label).join(', ')}}</template></template><template v-if="mapContext.activeQuery">; active object(s): <template v-if="mapContext.activeQuery.description">{{mapContext.activeQuery.description}}</template><code v-else>{{mapContext.activeQuery.query}}</code></template><template v-if="mapContext.filter">; filter: <code>{{mapContext.filter}}</code></template>)
			</b-form-checkbox>

			<b-form-checkbox v-model="showToolbox">Show toolbox</b-form-checkbox>
			<b-form-checkbox v-model="showSearch">Show search box</b-form-checkbox>
			<b-form-checkbox v-model="showLegend" v-if="hasLegend">Show legend</b-form-checkbox>
		</b-form-group>

		<b-form-group v-if="client.padData" label="Link type" :label-for="`${id}-padIdType-input`" label-cols-sm="3">
			<b-form-select :id="`${id}-padIdType-input`" :options="padIdTypes" v-model="padIdType"></b-form-select>
		</b-form-group>

		<b-tabs>
			<b-tab title="Share link">
				<div class="input-group mt-2">
					<input class="form-control" :value="url" readonly />
					<button type="button" class="btn btn-light" @click="copyUrl()">Copy</button>
				</div>
				<p class="mt-2">Share this link with others to allow them to open your map. <a href="https://docs.facilmap.org/users/share/" target="_blank">Learn more</a></p>
			</b-tab>
			<b-tab title="Embed">
				<div class="input-group mt-2">
					<b-form-textarea :value="embedCode" readonly></b-form-textarea>
					<button type="button" class="btn btn-light" @click="copyEmbedCode()">Copy</button>
				</div>
				<p class="mt-2">Add this HTML code to a web page to embed FacilMap. <a href="https://docs.facilmap.org/developers/embed.html" target="_blank">Learn more</a></p>
			</b-tab>
		</b-tabs>
	</b-modal>
</template>

<style lang="scss">
	.fm-share {
	}
</style>