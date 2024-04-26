import type Client from "facilmap-client";
import type { ClientEvents } from "facilmap-client";
import type { EventHandler } from "facilmap-types";
import { Bounds, Handler, LatLng, LatLngBounds, Map } from "leaflet";
import { leafletToFmBbox } from "./utils/leaflet";

const flyToBkp = Map.prototype.flyTo;
Map.prototype.flyTo = function(...args) {
	const [latlng, zoom] = args;
	this.fire("fmFlyTo", { latlng, zoom });
	return flyToBkp.apply(this, args);
};

function extendBounds(bounds: Bounds, pixels: number): Bounds {
	return new Bounds(
		[bounds.getTopLeft().x - pixels, bounds.getTopLeft().y - pixels],
		[bounds.getBottomRight().x + pixels, bounds.getBottomRight().y + pixels]
	);
}

export default class BboxHandler extends Handler {

	/**
	 * The min and max values how much wider the map pixel bounds should be used than what they actually are.
	 * By default, the max value is used. If the map is panned and the last bounds are still within the range
	 * of the min value, no update is triggered. This avoids an update every second when the locate control
	 * adjusts the map position very slightly.
	 */
	margin = [50, 400];
	lastBounds: { bounds: Bounds; zoom: number } | undefined = undefined;

	client: Client;

	constructor(map: Map, client: Client) {
		super(map);
		this.client = client;
	}

	updateBbox(center?: LatLng, zoom?: number): void {
		if (!this._map._loaded && (center == null || zoom == null))
			return;

		const resolvedZoom = zoom ?? this._map.getZoom();
		const pixelBounds = this._map.getPixelBounds(center, resolvedZoom);

		if (this.lastBounds && this.lastBounds.zoom === resolvedZoom) {
			const minBounds = extendBounds(pixelBounds, this.margin[0]);
			if (this.lastBounds.bounds.contains(minBounds)) {
				return;
			}
		}

		const maxBounds = extendBounds(pixelBounds, this.margin[1]);
		const bounds = new LatLngBounds(
			this._map.unproject(maxBounds.getBottomLeft(), resolvedZoom),
			this._map.unproject(maxBounds.getTopRight(), resolvedZoom)
		);
		void this.client.updateBbox(leafletToFmBbox(bounds, resolvedZoom));
		this.lastBounds = { bounds: maxBounds, zoom: resolvedZoom };
	}

	shouldUpdateBbox(): boolean {
		return !!this.client.mapData || !!this.client.route || Object.keys(this.client.routes).length > 0;
	}

	handleMoveEnd = (): void => {
		if (this.shouldUpdateBbox()) {
			this.updateBbox();
		}
	};

	handleViewReset = (): void => {
		if (this.shouldUpdateBbox()) {
			this.updateBbox();
		}
	};

	handleFlyTo = ({ latlng, zoom }: any): void => {
		if (this.shouldUpdateBbox()) {
			this.updateBbox(latlng, zoom);
		}
	};

	handleEmitResolve: EventHandler<ClientEvents, "emitResolve"> = (name, data) => {
		if (["createPad", "setPadId", "setRoute"].includes(name)) {
			this.updateBbox();
		}
	}

	addHooks(): void {
		this._map.on("moveend", this.handleMoveEnd);
		this._map.on("viewreset", this.handleViewReset);
		this._map.on("fmFlyTo", this.handleFlyTo);
		this.client.on("emitResolve", this.handleEmitResolve);

		if (this.shouldUpdateBbox()) {
			this.updateBbox();
		}
	}

	removeHooks(): void {
		this._map.off("moveend", this.handleMoveEnd);
		this._map.off("viewreset", this.handleViewReset);
		this._map.off("fmFlyTo", this.handleFlyTo);
		this.client.removeListener("emitResolve", this.handleEmitResolve);
		this.lastBounds = undefined;
	}
}