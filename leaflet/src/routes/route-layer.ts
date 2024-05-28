import { isReactivePropertyUpdate, type ReactiveObjectUpdate, type SocketClientStorage } from "facilmap-client";
import { Map, type PolylineOptions } from "leaflet";
import { type HighlightableLayerOptions, HighlightablePolyline } from "leaflet-highlightable-layers";
import { trackPointsToLatLngArray } from "../utils/leaflet";
import "leaflet-draggable-lines";

interface RouteLayerOptions extends HighlightableLayerOptions<PolylineOptions> {
}

export default class RouteLayer extends HighlightablePolyline {

	declare realOptions: RouteLayerOptions;
	clientStorage: SocketClientStorage;
	routeKey: string;
	protected unsubscribeStorageUpdate: (() => void) | undefined = undefined;

	constructor(clientStorage: SocketClientStorage, routeKey: string, options?: RouteLayerOptions) {
		super([], options);
		this.clientStorage = clientStorage;
		this.routeKey = routeKey;
	}

	onAdd(map: Map): this {
		super.onAdd(map);

		this.unsubscribeStorageUpdate = this.clientStorage.reactiveObjectProvider.subscribe((update) => this.handleStorageUpdate(update));
		// this.storage.on("route", this.handleRoute);
		// if (this.routeId)
		// 	this.storage.on("routePointsWithId", this.handleRoutePointsWithId);
		// else
		// 	this.storage.on("routePoints", this.handleRoutePoints);
		// this.storage.on("clearRoute", this.handleClearRoute);
		this.updateRoute();

		return this;
	}

	onRemove(map: Map): this {
		super.onRemove(map);

		this.unsubscribeStorageUpdate?.();
		this.unsubscribeStorageUpdate = undefined;
		// this.storage.removeListener("route", this.handleRoute);
		// this.storage.removeListener("routePoints", this.handleRoutePoints);
		// this.storage.removeListener("routePointsWithId", this.handleRoutePointsWithId);
		// this.storage.removeListener("clearRoute", this.handleClearRoute);

		return this;
	}

	protected handleStorageUpdate(update: ReactiveObjectUpdate): void {
		if (isReactivePropertyUpdate(update, this.clientStorage.routes, this.routeKey)) {
			this.updateRoute();
		}
	}

	updateRoute(): void {
		const route = this.clientStorage.routes[this.routeKey];
		if (route) {
			this.setDraggableLinesRoutePoints(route.routePoints.map((p) => [p.lat, p.lon]));
			this.setLatLngs(trackPointsToLatLngArray(route.trackPoints));
		} else {
			this.setLatLngs([]);
			this.setDraggableLinesRoutePoints([]);
		}
	}

}