import type Client from "facilmap-client";
import type { ClientEvents } from "facilmap-client";
import type { EventHandler } from "facilmap-types";
import { Handler, LatLng, LatLngBounds, Map } from "leaflet";
import { leafletToFmBbox } from "./utils/leaflet";

const flyToBkp = Map.prototype.flyTo;
Map.prototype.flyTo = function(...args) {
	const [latlng, zoom] = args;
	this.fire("fmFlyTo", { latlng, zoom });
	return flyToBkp.apply(this, args);
};

export default class BboxHandler extends Handler {

	margin = 50;

	client: Client;

	constructor(map: Map, client: Client) {
		super(map);
		this.client = client;
	}

	updateBbox(center?: LatLng, zoom?: number): void {
		if (!this._map._loaded && (center == null || zoom == null))
			return;

		const pixelBounds = this._map.getPixelBounds(center, zoom);
		pixelBounds.min!.x -= this.margin;
		pixelBounds.min!.y -= this.margin;
		pixelBounds.max!.x += this.margin;
		pixelBounds.max!.y += this.margin;

		const bounds = new LatLngBounds(
			this._map.unproject(pixelBounds.getBottomLeft(), zoom),
			this._map.unproject(pixelBounds.getTopRight(), zoom)
		);
		this.client.updateBbox(leafletToFmBbox(bounds ?? this._map.getBounds(), zoom ?? this._map.getZoom()));
	}

	handleMoveEnd = (): void => {
		if (this.client.padData || this.client.route || Object.keys(this.client.routes).length > 0) {
			this.updateBbox();
		}
	}

	handleFlyTo = ({ latlng, zoom }: any): void => {
		this.updateBbox(latlng, zoom);
	}

	handleEmitResolve: EventHandler<ClientEvents, "emitResolve"> = (name, data) => {
		if (["createPad", "setPadId", "setRoute"].includes(name)) {
			this.updateBbox();
		}
	}

	addHooks(): void {
		this._map.on("moveend", this.handleMoveEnd);
		this._map.on("fmFlyTo", this.handleFlyTo);
		this.client.on("emitResolve", this.handleEmitResolve);
	}

	removeHooks(): void {
		this._map.off("moveend", this.handleMoveEnd);
		this._map.off("fmFlyTo", this.handleFlyTo);
		this.client.removeListener("emitResolve", this.handleEmitResolve);
	}
}