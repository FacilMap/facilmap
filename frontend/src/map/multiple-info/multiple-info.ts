import WithRender from "./multiple-info.vue";
import Vue from "vue";
import { Component, Prop, Watch } from "vue-property-decorator";
import { ID, Line, Marker } from "facilmap-types";
import { Client, InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { showErrorToast } from "../../utils/toasts";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import "./multiple-info.scss";
import { combineZoomDestinations, flyTo, getZoomDestinationForLine, getZoomDestinationForMarker } from "../../utils/zoom";
import Icon from "../ui/icon/icon";
import StringMap from "../../utils/string-map";
import context from "../context";
import { isLine, isMarker } from "../../utils/utils";
import MarkerInfo from "../marker-info/marker-info";
import LineInfo from "../line-info/line-info";

@WithRender
@Component({
	components: { Icon, MarkerInfo, LineInfo }
})
export default class MultipleInfo extends Vue {
	
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: Array, required: true }) objects!: Array<Marker<StringMap> | Line<StringMap>>;

	isDeleting = false;
	openedObjectId: ID | null = null;
	openedObjectType: "marker" | "line" | null = null;
	activeTab = 0;

	get context(): typeof context {
		return context;
	}

	isMarker = isMarker;
	isLine = isLine;

	zoomToObject(object: Marker<StringMap> | Line<StringMap>): void {
		const zoomDestination = isMarker(object) ? getZoomDestinationForMarker(object) : isLine(object) ? getZoomDestinationForLine(object) : undefined;
		if (zoomDestination)
			flyTo(this.mapComponents.map, zoomDestination);
	}

	openObject(object: Marker<StringMap> | Line<StringMap>): void {
		this.openedObjectId = object.id;
		this.openedObjectType = isMarker(object) ? "marker" : isLine(object) ? "line" : null;
		this.activeTab = 1;
	}

	get openedObject(): Marker<StringMap> | Line<StringMap> | undefined {
		let openedObject: Marker<StringMap> | Line<StringMap> | undefined = undefined;
		if (this.openedObjectId != null) {
			if (this.openedObjectType == "marker")
				openedObject = this.client.markers[this.openedObjectId];
			else if (this.openedObjectType == "line")
				openedObject = this.client.lines[this.openedObjectId];
		}
		
		return openedObject && this.objects.includes(openedObject) ? openedObject : undefined;
	}

	@Watch("openedObject")
	handleOpenedObjectChange(): void {
		if (!this.openedObject)
			this.activeTab = 0;
	}

	async deleteObjects(): Promise<void> {
		this.$bvToast.hide("fm-multiple-info-delete");

		if (!this.objects || !await this.$bvModal.msgBoxConfirm(`Do you really want to remove ${this.objects.length} objects?`))
			return;
		
		this.isDeleting = true;
		try {
			for (const object of this.objects) {
				if (isMarker(object))
					await this.client.deleteMarker({ id: object.id });
				else if (isLine(object))
					await this.client.deleteLine({ id: object.id });
			}
		} catch (err) {
			showErrorToast(this, "fm-multiple-info-delete", "Error deleting objects", err);
		} finally {
			this.isDeleting = false;
		}
	}

	zoom(): void {
		const zoomDestination = combineZoomDestinations(this.objects.map((object) => {
			if (isMarker(object))
				return getZoomDestinationForMarker(object);
			else if (isLine(object))
				return getZoomDestinationForLine(object);
			else
				return undefined;
		}));
		if (zoomDestination)
			flyTo(this.mapComponents.map, zoomDestination);
	}

}