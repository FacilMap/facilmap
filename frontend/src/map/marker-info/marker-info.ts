import WithRender from "./marker-info.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ID, Marker } from "facilmap-types";
import { IdType } from "../../utils/utils";
import Client from "facilmap-client";
import { InjectClient } from "../client/client";
import { moveMarker } from "../ui/draw/draw";
import { InjectMapComponents, InjectMapContext, MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { showErrorToast } from "../../utils/toasts";
import EditMarker from "../edit-marker/edit-marker";

@WithRender
@Component({
	components: {
		EditMarker
	}
})
export default class MarkerInfo extends Vue {
	
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: IdType, required: true }) markerId!: ID;

	isSaving = false;

	get marker(): Marker | undefined {
		return this.client.markers[this.markerId];
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

	/*
	scope.useForRoute = function(mode) {
		map.searchUi.setRouteDestination(`${marker.lat},${marker.lon}`, mode);
	};
	*/

}