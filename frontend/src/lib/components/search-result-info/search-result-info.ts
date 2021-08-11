import WithRender from "./search-result-info.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { renderOsmTag } from "facilmap-utils";
import { SearchResult, Type } from "facilmap-types";
import Icon from "../ui/icon/icon";
import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import "./search-result-info.scss";
import { FileResult } from "../../utils/files";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { isLineResult, isMarkerResult } from "../../utils/search";
import { flyTo, getZoomDestinationForSearchResult } from "../../utils/zoom";
import { Context } from "../facilmap/facilmap";
import Coordinates from "../ui/coordinates/coordinates";

@WithRender
@Component({
	components: { Coordinates, Icon }
})
export default class SearchResultInfo extends Vue {

	@InjectContext() context!: Context;
	@InjectClient() client!: Client;
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectMapContext() mapContext!: MapContext;

	@Prop({ type: Object, required: true }) result!: SearchResult | FileResult;
	@Prop({ type: Boolean, default: false }) showBackButton!: boolean;
	@Prop({ type: Boolean, default: false }) isAdding!: boolean;

	renderOsmTag = renderOsmTag;

	get isMarker(): boolean {
		return isMarkerResult(this.result);
	}

	get isLine(): boolean {
		return isLineResult(this.result);
	}

	get types(): Type[] {
		// Result can be both marker and line
		return Object.values(this.client.types).filter((type) => (this.isMarker && type.type == "marker") || (this.isLine && type.type == "line"));
	}

	zoomToResult(): void {
		const dest = getZoomDestinationForSearchResult(this.result);
		if (dest)
			flyTo(this.mapComponents.map, dest);
	}

}