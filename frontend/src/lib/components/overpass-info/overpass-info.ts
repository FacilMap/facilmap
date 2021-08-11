import WithRender from "./overpass-info.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { renderOsmTag } from "facilmap-utils";
import { Type } from "facilmap-types";
import Icon from "../ui/icon/icon";
import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import "./overpass-info.scss";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
import { Context } from "../facilmap/facilmap";
import { OverpassElement } from "facilmap-leaflet";
import Coordinates from "../ui/coordinates/coordinates";

@WithRender
@Component({
	components: { Coordinates, Icon }
})
export default class OverpassInfo extends Vue {

	@InjectContext() context!: Context;
	@InjectClient() client!: Client;
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectMapContext() mapContext!: MapContext;

	@Prop({ type: Object, required: true }) element!: OverpassElement;
	@Prop({ type: Boolean, default: false }) showBackButton!: boolean;
	@Prop({ type: Boolean, default: false }) isAdding!: boolean;

	renderOsmTag = renderOsmTag;

	get types(): Type[] {
		return Object.values(this.client.types).filter((type) => type.type == "marker");
	}

	zoomToElement(): void {
		const dest = getZoomDestinationForMarker(this.element);
		if (dest)
			flyTo(this.mapComponents.map, dest);
	}

	useAs(event: "fm-route-set-from" | "fm-route-add-via" | "fm-route-set-to"): void {
		this.mapContext.$emit(event, `${this.element.lat},${this.element.lon}`);
		this.mapContext.$emit("fm-search-box-show-tab", `fm${this.context.id}-route-form-tab`);
	}

	useAsFrom(): void {
		this.useAs("fm-route-set-from");
	}

	useAsVia(): void {
		this.useAs("fm-route-add-via");
	}

	useAsTo(): void {
		this.useAs("fm-route-set-to");
	}

}