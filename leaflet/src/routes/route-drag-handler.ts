import { SocketClientStorage } from "facilmap-client";
import { Map, type Polyline } from "leaflet";
import DraggableLines, { type DraggableLinesHandlerOptions } from "leaflet-draggable-lines";

interface RouteDragHandlerOptions extends DraggableLinesHandlerOptions {
}

export default class RouteDragHandler extends DraggableLines {

	declare realOptions: RouteDragHandlerOptions;
	clientStorage: SocketClientStorage;

	constructor(map: Map, clientStorage: SocketClientStorage, options?: RouteDragHandlerOptions) {
		super(map, {
			enableForLayer: false,
			dragMarkerOptions: () => ({ pane: "fm-raised-marker" }),
			tempMarkerOptions: () => ({ pane: "fm-raised-marker" }),
			plusTempMarkerOptions: () => ({ pane: "fm-raised-marker" }),
			...options
		});
		this.clientStorage = clientStorage;

		this.on("dragend remove insert", this.handleDrag);
	}

	handleDrag = (e: any): void => {
		const routeKey: string = e.layer.routeKey;
		const subscription = this.clientStorage.client.routeSubscriptions[routeKey];
		const route = this.clientStorage.routes[routeKey];
		if (subscription && route) {
			const routePoints = (e.layer as Polyline).getDraggableLinesRoutePoints();

			if (routePoints) {
				void subscription.updateSubscription({
					...route,
					routePoints: routePoints.map((p) => ({ lat: p.lat, lon: p.lng }))
				});
			}
		}
	}

}