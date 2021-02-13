import Socket from "facilmap-client";
import { Map, PathOptions, PolylineOptions } from "leaflet";
import { HighlightableLayerOptions, HighlightablePolyline } from "leaflet-highlightable-layers";
import { trackPointsToLatLngArray } from "../utils/leaflet";
import DraggableLines from "leaflet-draggable-lines";

interface RouteLayerOptions extends PolylineOptions {
}

export default class RouteLayer extends HighlightablePolyline {

	realOptions!: RouteLayerOptions;
	client: Socket;
	draggable?: DraggableLines;

	constructor(client: Socket, options?: RouteLayerOptions) {
		super([], options);
		this.client = client;
	}

	onAdd(map: Map) {
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

	onRemove(map: Map) {
		super.onRemove(map);

		this.client.removeListener("route", this.handleRoute);
		this.client.removeListener("routePoints", this.handleRoutePoints);

		this.draggable!.off("dragend remove insert", this.handleDrag);
		this.draggable!.disableForLayer(this);
		this.draggable!.disable();

		return this;
	}

	handleDrag = () => {
		this.updateRoute();
	};

	handleRoute = () => {
		this.updateLine(true);
	};

	handleRoutePoints = () => {
		this.updateLine(false);
	};

	updateRoute() {
		if (this.client.route) {
			this.client.setRoute({
				...this.client.route,
				routePoints: this.getDraggableLinesRoutePoints()!.map((p) => ({ lat: p.lat, lon: p.lng }))
			});
		}
	}

	updateLine(updateRoutePoints: boolean) {
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

	updateDraggableStyle() {
		if (this.draggable) {
			Object.assign(this.draggable.options, {
				dragMarkerOptions: () => ({ pane: "fm-raised-marker" }),
				tempMarkerOptions: () => ({ pane: "fm-raised-marker" }),
				plusTempMarkerOptions: () => ({ pane: "fm-raised-marker" })
			});
			this.draggable.redraw();
		}
	}

	setStyle(style: HighlightableLayerOptions<PathOptions>) {
		super.setStyle(style);

		this.updateDraggableStyle();

		return this;
	}

}