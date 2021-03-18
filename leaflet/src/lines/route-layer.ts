import Client from "facilmap-client";
import { Map, PolylineOptions } from "leaflet";
import { HighlightableLayerOptions, HighlightablePolyline } from "leaflet-highlightable-layers";
import { trackPointsToLatLngArray } from "../utils/leaflet";
import "leaflet-draggable-lines";

interface RouteLayerOptions extends HighlightableLayerOptions<PolylineOptions> {
}

export default class RouteLayer extends HighlightablePolyline {

	realOptions!: RouteLayerOptions;
	client: Client;

	constructor(client: Client, options?: RouteLayerOptions) {
		super([], options);
		this.client = client;
	}

	onAdd(map: Map): this {
		super.onAdd(map);

		this.client.on("route", this.handleRoute);
		this.client.on("routePoints", this.handleRoutePoints);
		this.updateLine(true);

		return this;
	}

	onRemove(map: Map): this {
		super.onRemove(map);

		this.client.removeListener("route", this.handleRoute);
		this.client.removeListener("routePoints", this.handleRoutePoints);

		return this;
	}

	handleRoute = (): void => {
		this.updateLine(true);
	};

	handleRoutePoints = (): void => {
		this.updateLine(false);
	};

	updateLine(updateRoutePoints: boolean): void {
		if (this.client.route) {
			if (updateRoutePoints)
				this.setDraggableLinesRoutePoints(this.client.route.routePoints.map((p) => [p.lat, p.lon]));

			const trackPoints = trackPointsToLatLngArray(this.client.route.trackPoints);
			this.setLatLngs(trackPoints);
		} else {
			this.setLatLngs([]);
		}
	}

}