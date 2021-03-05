import Client from "facilmap-client";
import { Map, PathOptions, PolylineOptions } from "leaflet";
import { HighlightableLayerOptions, HighlightablePolyline } from "leaflet-highlightable-layers";
import { trackPointsToLatLngArray } from "../utils/leaflet";
import DraggableLines from "leaflet-draggable-lines";

interface RouteLayerOptions extends HighlightableLayerOptions<PolylineOptions> {
}

export default class RouteLayer extends HighlightablePolyline {

	realOptions!: RouteLayerOptions;
	client: Client;
	draggable?: DraggableLines;

	constructor(client: Client, options?: RouteLayerOptions) {
		super([], options);
		this.client = client;
	}

	onAdd(map: Map): this {
		super.onAdd(map);

		this.draggable = new DraggableLines(map, { enableForLayer: false });
		this.draggable.enable();
		this.draggable.on("dragend remove insert", this.handleDrag);
		this.updateDraggableStyle();

		this.client.on("route", this.handleRoute);
		this.client.on("routePoints", this.handleRoutePoints);
		this.updateLine(true);

		return this;
	}

	onRemove(map: Map): this {
		super.onRemove(map);

		this.client.removeListener("route", this.handleRoute);
		this.client.removeListener("routePoints", this.handleRoutePoints);

		this.draggable!.off("dragend remove insert", this.handleDrag);
		this.draggable!.disableForLayer(this);
		this.draggable!.disable();

		return this;
	}

	handleDrag = (): void => {
		this.updateRoute();
	};

	handleRoute = (): void => {
		this.updateLine(true);
	};

	handleRoutePoints = (): void => {
		this.updateLine(false);
	};

	updateRoute(): void {
		if (this.client.route) {
			this.client.setRoute({
				...this.client.route,
				routePoints: this.getDraggableLinesRoutePoints()!.map((p) => ({ lat: p.lat, lon: p.lng }))
			});
		}
	}

	updateLine(updateRoutePoints: boolean): void {
		if (this.client.route) {
			if (updateRoutePoints)
				this.setDraggableLinesRoutePoints(this.client.route.routePoints.map((p) => [p.lat, p.lon]));

			const trackPoints = trackPointsToLatLngArray(this.client.route.trackPoints);
			this.setLatLngs(trackPoints);

			this.draggable!.enableForLayer(this);
		} else {
			this.setLatLngs([]);
			this.draggable!.disableForLayer(this);
		}
	}

	updateDraggableStyle(): void {
		if (this.draggable) {
			Object.assign(this.draggable.options, {
				dragMarkerOptions: () => ({ pane: "fm-raised-marker" }),
				tempMarkerOptions: () => ({ pane: "fm-raised-marker" }),
				plusTempMarkerOptions: () => ({ pane: "fm-raised-marker" })
			});
			this.draggable.redraw();
		}
	}

	setStyle(style: HighlightableLayerOptions<PathOptions>): this {
		super.setStyle(style);

		this.updateDraggableStyle();

		return this;
	}

}