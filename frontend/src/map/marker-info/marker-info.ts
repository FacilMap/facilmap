import WithRender from "./marker-info.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { FindOnMapResult, ID, Marker } from "facilmap-types";
import { IdType } from "../../utils/utils";
import { moveMarker } from "../../utils/draw";
import { Client, InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { showErrorToast } from "../../utils/toasts";
import EditMarker from "../edit-marker/edit-marker";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import "./marker-info.scss";
import { flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
import Icon from "../ui/icon/icon";
import StringMap from "../../utils/string-map";
import context from "../context";

@WithRender
@Component({
	components: { EditMarker, Icon }
})
export default class MarkerInfo extends Vue {
	
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: IdType, required: true }) markerId!: ID;

	isSaving = false;

	get marker(): Marker<StringMap> | undefined {
		return this.client.markers[this.markerId];
	}

	get context(): typeof context {
		return context;
	}

	move(): void {
		moveMarker(this.markerId, this, this.client, this.mapComponents);
	}

	async deleteMarker(): Promise<void> {
		this.$bvToast.hide("fm-marker-info-delete");

		if (!this.marker || !await this.$bvModal.msgBoxConfirm(`Do you really want to remove the marker “${this.marker.name}”?`))
			return;
		
		this.isSaving = true;
		try {
			await this.client.deleteMarker({ id: this.markerId });
		} catch (err) {
			showErrorToast(this, "fm-marker-info-delete", "Error deleting marker", err);
		} finally {
			this.isSaving = false;
		}
	}

	zoomToMarker(): void {
		if (this.marker)
			flyTo(this.mapComponents.map, getZoomDestinationForMarker(this.marker));
	}

	useAs(event: "fm-route-set-from" | "fm-route-add-via" | "fm-route-set-to"): void {
		if (!this.marker)
			return;

		const markerSuggestion: FindOnMapResult = { ...this.marker, kind: "marker", similarity: 1 };
		this.mapContext.$emit(event, this.marker.name, [], [markerSuggestion], markerSuggestion);
		this.mapContext.$emit("fm-search-box-show-tab", "fm-route-form-tab");
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