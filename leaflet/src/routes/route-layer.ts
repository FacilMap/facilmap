import type SocketClient from "facilmap-client";
import type { RouteWithTrackPoints } from "facilmap-client";
import { Map, type PolylineOptions } from "leaflet";
import { type HighlightableLayerOptions, HighlightablePolyline } from "leaflet-highlightable-layers";
import { trackPointsToLatLngArray } from "../utils/leaflet";
import "leaflet-draggable-lines";
import type { RouteClear, RoutePoints } from "facilmap-types";

interface RouteLayerOptions extends HighlightableLayerOptions<PolylineOptions> {
}

export default class RouteLayer extends HighlightablePolyline {

	declare realOptions: RouteLayerOptions;
	client: SocketClient;
	routeId: string | undefined;

	constructor(client: SocketClient, routeId?: string, options?: RouteLayerOptions) {
		super([], options);
		this.client = client;
		this.routeId = routeId;
	}

	onAdd(map: Map): this {
		super.onAdd(map);

		this.client.on("route", this.handleRoute);
		if (this.routeId)
			this.client.on("routePointsWithId", this.handleRoutePointsWithId);
		else
			this.client.on("routePoints", this.handleRoutePoints);
		this.client.on("clearRoute", this.handleClearRoute);
		this.updateLine(true);

		return this;
	}

	onRemove(map: Map): this {
		super.onRemove(map);

		this.client.removeListener("route", this.handleRoute);
		this.client.removeListener("routePoints", this.handleRoutePoints);
		this.client.removeListener("routePointsWithId", this.handleRoutePointsWithId);
		this.client.removeListener("clearRoute", this.handleClearRoute);

		return this;
	}

	handleRoute = (route: RouteWithTrackPoints): void => {
		if (this.routeId ? (route.routeId == this.routeId) : !route.routeId)
			this.updateLine(true);
	};

	handleRoutePoints = (): void => {
		this.updateLine(false);
	};

	handleRoutePointsWithId = (data: RoutePoints): void => {
		if (this.routeId == data.routeId)
			this.updateLine(false);
	};

	handleClearRoute = (data: RouteClear): void => {
		if (this.routeId ? (data.routeId == this.routeId) : !data.routeId)
			this.updateLine(true);
	}

	updateLine(updateRoutePoints: boolean): void {
		const route = this.routeId ? this.client.routes[this.routeId] : this.client.route;
		if (route) {
			if (updateRoutePoints)
				this.setDraggableLinesRoutePoints(route.routePoints.map((p) => [p.lat, p.lon]));

			const trackPoints = trackPointsToLatLngArray(route.trackPoints);
			this.setLatLngs(trackPoints);
		} else {
			this.setLatLngs([]);
			this.setDraggableLinesRoutePoints([]);
		}
	}

}