import Client from "facilmap-client";
import { Map, Polyline } from "leaflet";
import DraggableLines, { DraggableLinesHandlerOptions } from "leaflet-draggable-lines";

interface RouteDragHandlerOptions extends DraggableLinesHandlerOptions {
}

export default class RouteDragHandler extends DraggableLines {

	declare realOptions: RouteDragHandlerOptions;
	client: Client<any>;

	constructor(map: Map, client: Client<any>, options?: RouteDragHandlerOptions) {
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
		const route = e.layer.routeId ? this.client.routes[e.layer.routeId] : this.client.route;
		if (route) {
			const routePoints = (e.layer as Polyline).getDraggableLinesRoutePoints();

			if (routePoints) {
				this.client.setRoute({
					...route,
					routePoints: routePoints.map((p) => ({ lat: p.lat, lon: p.lng }))
				});
			}
		}
	}

}