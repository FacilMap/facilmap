import WithRender from "./overpass-multiple-info.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import "./overpass-multiple-info.scss";
import { combineZoomDestinations, flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
import Icon from "../ui/icon/icon";
import { Context } from "../facilmap/facilmap";
import OverpassInfo from "./overpass-info";
import { OverpassElement } from "facilmap-leaflet";
import { MarkerCreate, Type } from "facilmap-types";
import { SelectedItem } from "../../utils/selection";
import { showErrorToast } from "../../utils/toasts";
import StringMap from "../../utils/string-map";
import { mapTagsToType } from "../search-results/utils";

@WithRender
@Component({
	components: { Icon, OverpassInfo }
})
export default class OverpassMultipleInfo extends Vue {

	@InjectContext() context!: Context;
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: Array, required: true }) elements!: OverpassElement[];

	openedElement: OverpassElement | null = null;
	activeTab = 0;
	isAdding = false;

	get types(): Type[] {
		return Object.values(this.client.types).filter((type) => type.type == "marker");
	}

	zoomToElement(element: OverpassElement): void {
		const zoomDestination = getZoomDestinationForMarker(element);
		if (zoomDestination)
			flyTo(this.mapComponents.map, zoomDestination);
	}

	openElement(element: OverpassElement): void {
		this.openedElement = element;
		this.activeTab = 1;
	}

	zoom(): void {
		const zoomDestination = combineZoomDestinations(this.elements.map((element) => getZoomDestinationForMarker(element)));
		if (zoomDestination)
			flyTo(this.mapComponents.map, zoomDestination);
	}

	async addToMap(elements: OverpassElement[], type: Type): Promise<void> {
		this.$bvToast.hide(`fm${this.context.id}-overpass-multiple-info-add-error`);
		this.isAdding = true;

		try {
			const selection: SelectedItem[] = [];

			for (const element of elements) {
				const obj: Partial<MarkerCreate<StringMap>> = {
					name: element.tags.name || "",
					data: mapTagsToType(element.tags || {}, type)
				};

				const marker = await this.client.addMarker({
					...obj,
					lat: element.lat,
					lon: element.lon,
					typeId: type.id
				});

				selection.push({ type: "marker", id: marker.id });
			}

			this.mapComponents.selectionHandler.setSelectedItems(selection, true);
		} catch (err) {
			showErrorToast(this, `fm${this.context.id}-overpass-multiple-info-add-error`, "Error adding to map", err);
		} finally {
			this.isAdding = false;
		}
	}

}