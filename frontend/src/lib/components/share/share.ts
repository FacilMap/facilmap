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

	@InjectContext() context!: Context;
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

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
