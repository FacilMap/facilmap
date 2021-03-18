import Client from "facilmap-client";
import { Map, Polyline } from "leaflet";
import DraggableLines from "leaflet-draggable-lines";
import { DraggableLinesHandlerOptions } from "leaflet-draggable-lines/dist/handler";

interface RouteDragHandlerOptions extends DraggableLinesHandlerOptions {
}

export default class RouteDragHandler extends DraggableLines {

	realOptions!: RouteDragHandlerOptions;
	client: Client;

	constructor(map: Map, client: Client, options?: RouteDragHandlerOptions) {
		super(map, {
			enableForLayer: false,
			dragMarkerOptions: () => ({ pane: "fm-raised-marker" }),
			tempMarkerOptions: () => ({ pane: "fm-raised-marker" }),
			plusTempMarkerOptions: () => ({ pane: "fm-raised-marker" }),
			...options
		});
		this.client = client;

		this.on("dragend remove insert", this.handleDrag);
	}

	handleDrag = (e: any): void => {
		if (this.client.route) {
			const routePoints = (e.layer as Polyline).getDraggableLinesRoutePoints();

			if (routePoints) {
				this.client.setRoute({
					...this.client.route,
					routePoints: routePoints.map((p) => ({ lat: p.lat, lon: p.lng }))
				});
			}
		}
	}

}