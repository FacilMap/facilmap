import type { SocketClient } from "facilmap-client";
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

/**
 * Calls setBbox() on the client when the bbox of the map changes (only if there are any map/route subscriptions).
 */
export default class BboxHandler extends Handler {

	protected _shouldUpdateBbox = false;
	protected _unsubscribeClientUpdate: (() => void) | undefined = undefined;

	/**
	 * The min and max values how much wider the map pixel bounds should be used than what they actually are.
	 * By default, the max value is used. If the map is panned and the last bounds are still within the range
	 * of the min value, no update is triggered. This avoids an update every second when the locate control
	 * adjusts the map position very slightly.
	 */
	protected margin = [50, 400];
	protected lastBounds: { bounds: Bounds; zoom: number } | undefined = undefined;

	client: SocketClient;

	constructor(map: Map, client: SocketClient) {
		super(map);
		this.client = client;
	}

	/**
	 * Calls the setBbox method on the client with the current map bbox. If a custom center and zoom is supplied, the
	 * method is called with its bbox instead. This can be used for example when the next bbox is known in advance,
	 * for example when flying to a new place on the map.
	 */
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
		void this.client.setBbox(leafletToFmBbox(bounds, resolvedZoom));
		this.lastBounds = { bounds: maxBounds, zoom: resolvedZoom };
	}

	/**
	 * Returns true if the client is subscribed to any map/route and thus the bbox should be kept up to date.
	 */
	shouldUpdateBbox(): boolean {
		return this._shouldUpdateBbox;
	}

	protected handleMoveEnd = (): void => {
		if (this.shouldUpdateBbox()) {
			this.updateBbox();
		}
	};

	protected handleViewReset = (): void => {
		if (this.shouldUpdateBbox()) {
			this.updateBbox();
		}
	};

	protected handleFlyTo = ({ latlng, zoom }: any): void => {
		if (this.shouldUpdateBbox()) {
			this.updateBbox(latlng, zoom);
		}
	};

	protected handleClientUpdate(): void {
		const before = this._shouldUpdateBbox;
		this._shouldUpdateBbox = Object.keys(this.client.mapSubscriptions).length > 0 || Object.keys(this.client.routeSubscriptions).length > 0;
		if (!before && this._shouldUpdateBbox) {
			this.updateBbox();
		}
	}

	override addHooks(): void {
		this._map.on("moveend", this.handleMoveEnd);
		this._map.on("viewreset", this.handleViewReset);
		this._map.on("fmFlyTo", this.handleFlyTo);
		this._unsubscribeClientUpdate = this.client.reactiveObjectProvider.subscribe(() => this.handleClientUpdate());

		if (this.shouldUpdateBbox()) {
			this.updateBbox();
		}
	}

	override removeHooks(): void {
		this._map.off("moveend", this.handleMoveEnd);
		this._map.off("viewreset", this.handleViewReset);
		this._map.off("fmFlyTo", this.handleFlyTo);
		this._unsubscribeClientUpdate?.();
		this._unsubscribeClientUpdate = undefined;
		this.lastBounds = undefined;
	}
}